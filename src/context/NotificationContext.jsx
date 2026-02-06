import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { useAuth } from './AuthContext'

const NotificationContext = createContext({})

export const useNotifications = () => useContext(NotificationContext)

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const tokenRef = useRef(null)

  // Cache auth token
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      tokenRef.current = session?.access_token || null
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token || null
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load notifications on mount
  useEffect(() => {
    if (!user) return

    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) {
          console.error('Error loading notifications:', error)
          return
        }

        setNotifications(data || [])
        setUnreadCount((data || []).filter(n => !n.read).length)
      } catch (err) {
        console.error('Error loading notifications:', err)
      }
    }

    loadNotifications()
  }, [user])

  // Subscribe to realtime for new notifications
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new
          setNotifications(prev => [newNotification, ...prev])
          setUnreadCount(prev => prev + 1)

          // Show browser desktop notification if tab is hidden
          if (
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.visibilityState === 'hidden'
          ) {
            new Notification(newNotification.title, {
              body: newNotification.body || '',
              icon: '/logo.png',
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied') return 'denied'
    const result = await Notification.requestPermission()
    return result
  }, [])

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)

    try {
      if (!user) return
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', user.id)
        .eq('read', false)
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }, [user])

  // Delete a single notification
  const deleteNotification = useCallback(async (notificationId) => {
    const notif = notifications.find(n => n.id === notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    if (notif && !notif.read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }, [notifications])

  // Delete all notifications
  const deleteAllNotifications = useCallback(async () => {
    setNotifications([])
    setUnreadCount(0)

    try {
      if (!user) return
      await supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', user.id)
    } catch (err) {
      console.error('Error deleting all notifications:', err)
    }
  }, [user])

  // Send a notification to a specific user (via raw fetch)
  const sendNotification = useCallback(async (recipientId, type, title, body, data = {}) => {
    const token = tokenRef.current || supabaseAnonKey

    try {
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          recipient_id: recipientId,
          type,
          title,
          body,
          data,
        }),
      })
    } catch (err) {
      console.error('Error sending notification:', err)
    }
  }, [])

  // Send notifications to all users except sender
  const notifyAllExcept = useCallback(async (senderId, type, title, body, data = {}) => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')

      if (error || !profiles) return

      const recipients = profiles.filter(p => p.id !== senderId)
      await Promise.all(
        recipients.map(p => sendNotification(p.id, type, title, body, data))
      )
    } catch (err) {
      console.error('Error notifying users:', err)
    }
  }, [sendNotification])

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    requestNotificationPermission,
    sendNotification,
    notifyAllExcept,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
