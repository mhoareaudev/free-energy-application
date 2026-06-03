// Sheet configurations with frozen columns and column groups

export const SHEETS = [
  {
    id: 'btoc-comptant',
    name: 'Suivi activit\u00e9s BtoC \u2013 Comptant',
    frozenColumns: ['COMMERCIAL', 'OBJECTIF', 'Colonne1'],
  },
  {
    id: 'btoc-comptant-old',
    name: 'Suivi activit\u00e9s BtoC \u2013 Comptant (old)',
    frozenColumns: ['COMMERCIAL', 'OBJECTIF', 'Colonne1'],
  },
  {
    id: 'btoc-abonnement',
    name: 'Suivi activit\u00e9s BtoC \u2013 Abonnement',
    frozenColumns: ['COMMERCIAL', 'OBJECTIF', 'NOM - PRENOM CLIENT'],
  },
  {
    id: 'btob',
    name: 'Suivi activit\u00e9s BtoB',
    frozenColumns: ['COMMERCIAL', 'OBJECTIF', 'NOM - PRENOM CLIENT'],
  },
]

// Color palette: border (contours), dark (lettres + groupes), medium (titres colonnes), light (cellules)
const COLORS = {
  jaune:     { border: '#E5A700', dark: '#FCD34D', medium: '#FDE68A', light: '#FFFBEB' },
  bleu:      { border: '#3B82F6', dark: '#93C5FD', medium: '#BFDBFE', light: '#EFF6FF' },
  vert:      { border: '#10B981', dark: '#6EE7B7', medium: '#A7F3D0', light: '#ECFDF5' },
  rouge:     { border: '#EF4444', dark: '#FCA5A5', medium: '#FECACA', light: '#FEF2F2' },
  mauve:     { border: '#8B5CF6', dark: '#C4B5FD', medium: '#DDD6FE', light: '#F5F3FF' },
  gris:      { border: '#9CA3AF', dark: '#D1D5DB', medium: '#E5E7EB', light: '#F9FAFB' },
  bleuClair: { border: '#0EA5E9', dark: '#7DD3FC', medium: '#BAE6FD', light: '#F0F9FF' },
  bleuFonce: { border: '#6366F1', dark: '#818CF8', medium: '#A5B4FC', light: '#EEF2FF' },
}

// BtoC Comptant columns
export const BTOC_COMPTANT_COLUMNS = {
  frozen: [
    { id: 'COMMERCIAL', label: 'COMMERCIAL', width: 120 },
    { id: 'OBJECTIF', label: 'OBJECTIF', width: 100 },
    { id: 'Colonne1', label: 'Colonne1', width: 100 },
  ],
  groups: [
    {
      name: 'Progression prospect',
      colors: COLORS.jaune,
      columns: [
        { id: 'RDV_PRIS_LE', label: 'RDV PRIS LE', width: 110 },
        { id: 'RDV_PERDU', label: 'RDV PERDU', width: 100 },
        { id: 'SIGNATURE_POTENTIELLE', label: 'SIGNATURE POTENTIELLE', width: 160 },
        { id: 'PUISSANCE_PREVI', label: 'PUISSANCE PREVI', width: 130 },
        { id: 'PUISSANCE_REALISEE', label: 'PUISSANCE REALISEE', width: 150 },
        { id: 'SIGNE_LE', label: 'SIGNE LE', width: 100 },
        { id: 'MEMOS_TECHNIQUE', label: 'MEMOS TECHNIQUE', width: 140 },
        { id: 'CONTRAT_MAINTENANCE', label: 'CONTRAT DE MAINTENANCE', width: 170 },
        { id: 'VENTES_PRIVEES', label: 'VENTES PRIVEES', width: 120 },
        { id: 'NUITS_ROCHES_NOIR', label: 'NUITS ROCHES NOIR', width: 140 },
        { id: 'DATE_TRANSMISSION', label: 'DATE TRANSMISSION', width: 150 },
      ],
    },
    {
      name: 'Coordonn\u00e9es clients',
      colors: COLORS.bleu,
      columns: [
        { id: 'TYPE_CONTACT', label: 'TYPE DE CONTACT', width: 130 },
        { id: 'ADRESSE_INSTALLATION', label: 'ADRESSE INSTALLATION', width: 170 },
        { id: 'VILLE', label: 'VILLE', width: 100 },
        { id: 'CODE_POSTAL', label: 'CODE POSTALE', width: 110 },
        { id: 'TYPE_PRODUIT', label: 'TYPE DE PRODUIT', width: 130 },
        { id: 'TELEPHONE', label: 'TELEPHONE', width: 110 },
        { id: 'EMAIL', label: 'EMAIL', width: 180 },
      ],
    },
    {
      name: 'Admin',
      colors: COLORS.vert,
      columns: [
        { id: 'RECEPTION_BDC', label: 'RECEPTION BDC/DOSSIER', width: 170 },
        { id: 'ENREGISTREMENT_ADMIN', label: 'ENREGISTREMENT ADMINISTRATIF', width: 210 },
      ],
    },
    {
      name: 'R\u00e8glement',
      colors: COLORS.rouge,
      columns: [
        { id: 'TOTAL_TTC', label: 'TOTAL TTC', width: 100 },
        { id: 'RESTE_ENCAISSER', label: 'RESTE A ENCAISSER', width: 150 },
        { id: 'ACOMPTE_1', label: 'Acpte 1 (Validation Technique)', width: 200 },
        { id: 'ACOMPTE_2', label: 'Acpte 2 (R\u00e9ception CNO)', width: 180 },
        { id: 'ACOMPTE_3', label: 'Acpte 3 (Date pr\u00e9v pose)', width: 180 },
        { id: 'SOLDE', label: 'SOLDE (Livraison)', width: 140 },
        { id: 'FINANCEMENT', label: 'FINANCEMENT', width: 120 },
        { id: 'DATE_ACCEPTATION', label: "DATE D'ACCEPTATION", width: 150 },
        { id: 'N_AUTORISATION', label: 'N\u00b0 AUTORISATION ou DOSSIER', width: 200 },
        { id: 'ETAT_DOSSIER_CMOI', label: 'ETAT DU DOSSIER CMOI/SOFIDER', width: 210 },
        { id: 'DATE_DDE_PAIEMENT', label: 'DATE DE DEMANDE PAIEMENT', width: 190 },
        { id: 'DATE_PAIEMENT', label: 'DATE PAIEMENT', width: 130 },
      ],
    },
    {
      name: 'Avancement du dossier',
      colors: COLORS.mauve,
      columns: [
        { id: 'DATE_DDE_VT', label: 'DATE DEMANDE DE LA VT', width: 170 },
        { id: 'ECHEANCE', label: 'ECHEANCE', width: 100 },
        { id: 'DATE_PREV_VT', label: 'DATE PREV DE LA VT', width: 150 },
        { id: 'DATE_RETOUR_VT', label: 'DATE RETOUR DE LA VT', width: 160 },
        { id: 'CHARGES_AFFAIRES', label: "CHARGES D'AFFAIRES", width: 150 },
        { id: 'DEMANDE_DP', label: 'DEMANDE DP', width: 110 },
        { id: 'N_DP', label: 'N\u00b0 DP', width: 80 },
        { id: 'RECEPTION_CNO', label: 'RECEPTION CNO', width: 130 },
        { id: 'ETAT_DOSSIER', label: 'ETAT DU DOSSIER', width: 140 },
        { id: 'DATE_PREV_POSE', label: 'DATE PREVISIONNEL DE POSE', width: 190 },
        { id: 'DATE_REELLE_POSE', label: 'DATE REELLE DE POSE', width: 160 },
        { id: 'POSEUR', label: 'POSEUR', width: 100 },
        { id: 'PHOTOS', label: 'PHOTOS', width: 80, align: 'center' },
        { id: 'ATTESTATION_ASSURANCE', label: 'ATTESTATION ASSURANCE', width: 170, align: 'center' },
        { id: 'DDE_RACC_EDF', label: 'DDE RACC EDF', width: 120 },
        { id: 'N_SUIVI_EDF', label: 'N\u00b0DE SUIVI EDF', width: 130 },
        { id: 'T0_REVENTE', label: 'T0 REVENTE RECU', width: 140 },
        { id: 'N_CRAE', label: 'N\u00b0CRAE', width: 90 },
        { id: 'DDE_SUBVENTION', label: 'DDE DE SUBVENTION', width: 150 },
        { id: 'NUMERO_DOSSIER', label: 'NUMERO DE DOSSIER', width: 150 },
        { id: 'DATE_VALIDER_SUB', label: 'DATE VALIDER DE SUBVENTION', width: 200 },
        { id: 'FIN_VALIDATION_SUB', label: 'FIN DE VALIDATION SUBVENTION', width: 210 },
        { id: 'DDE_CONSUEL', label: 'DDE CONSUEL', width: 110 },
        { id: 'CONSUEL_VISE', label: 'CONSUEL VISE', width: 120 },
        { id: 'T0_AUTO_CONSO', label: 'T0 AUTO CONSO', width: 130 },
        { id: 'DDE_MES_EDF', label: 'DDE DE MES EDF', width: 130 },
        { id: 'MES_EDF', label: 'MES EDF', width: 90 },
      ],
    },
    {
      name: 'Monophase',
      colors: COLORS.gris,
      columns: [
        { id: 'MONO_OND_3KW', label: 'OND 3KW', width: 90 },
        { id: 'MONO_OND_6KW', label: 'OND 6KW', width: 90 },
        { id: 'MONO_BATTERIE', label: 'BATTERIE', width: 90 },
        { id: 'MONO_SMGUARD', label: 'SMGUARD', width: 90 },
      ],
    },
    {
      name: 'Triphase',
      colors: COLORS.bleuClair,
      columns: [
        { id: 'TRI_OND_3KW', label: 'OND 3KW2', width: 90 },
        { id: 'TRI_OND_6KW', label: 'OND 6KW2', width: 90 },
        { id: 'TRI_STOCKAGE', label: 'STOCKAGE', width: 90 },
        { id: 'TRI_SMGUARD', label: 'SM GUARD', width: 90 },
      ],
    },
  ],
}

// BtoC Abonnement columns
export const BTOC_ABONNEMENT_COLUMNS = {
  frozen: [
    { id: 'COMMERCIAL', label: 'COMMERCIAL', width: 120 },
    { id: 'OBJECTIF', label: 'OBJECTIF', width: 100 },
    { id: 'NOM_PRENOM', label: 'NOM - PRENOM CLIENT', width: 160 },
  ],
  groups: [
    {
      name: 'Progression prospect',
      colors: COLORS.jaune,
      columns: [
        { id: 'RDV_PRIS_LE', label: 'RDV PRIS LE', width: 110 },
        { id: 'RDV_PERDU', label: 'RDV PERDU', width: 100 },
        { id: 'SIGNATURE_POTENTIELLE', label: 'SIGNATURE POTENTIELLE', width: 160 },
        { id: 'ETAT_DOSSIER_ADMIN', label: 'ETAT DU DOSSIER AMINISTRATIF', width: 210 },
        { id: 'PUISSANCE_REALISEE', label: 'PUISSANCE REALISEE', width: 150 },
        { id: 'SIGNE_LE', label: 'SIGNE LE', width: 100 },
      ],
    },
    {
      name: 'Commentaires',
      colors: COLORS.bleu,
      columns: [
        { id: 'OFFRE_CHOISIE', label: "L'OFFRE CHOISIE", width: 130 },
        { id: 'OPTION_CONFORT', label: 'OPTION CONFORT (Batterie)', width: 180 },
        { id: 'MEMOS_TECHNIQUE', label: 'MEMOS TECHNIQUE', width: 140 },
        { id: 'VENTES_PRIVEES', label: 'VENTES PRIVEES - NUITS ROCHES NOIR', width: 230 },
      ],
    },
    {
      name: 'Coordonn\u00e9es clients',
      colors: COLORS.vert,
      columns: [
        { id: 'TYPE_CONTACT', label: 'TYPE DE CONTACT', width: 130 },
        { id: 'ADRESSE_INSTALLATION', label: 'ADRESSE INSTALLATION', width: 170 },
        { id: 'VILLE', label: 'VILLE', width: 100 },
        { id: 'CODE_POSTAL', label: 'CODE POSTALE', width: 110 },
        { id: 'TYPE_PRODUIT', label: 'TYPE DE PRODUIT', width: 130 },
        { id: 'TELEPHONE', label: 'TELEPHONE', width: 110 },
        { id: 'EMAIL', label: 'EMAIL', width: 180 },
      ],
    },
    {
      name: 'Admin',
      colors: COLORS.rouge,
      columns: [
        { id: 'RECEPTION_BDC', label: 'RECEPTION BDC/DOSSIER', width: 170 },
        { id: 'ENREGISTREMENT_ADMIN', label: 'ENREGISTREMENT ADMINISTRATIF', width: 210 },
      ],
    },
    {
      name: 'Informations r\u00e8glements',
      colors: COLORS.mauve,
      columns: [
        { id: 'INFO_COL1', label: 'Colonne1', width: 100 },
        { id: 'MONTANT_DEPOT_GARANTIE', label: 'MONTANT DU DEP\u00d4T DE GARANTIE', width: 220 },
        { id: 'DATE_ENCAISSEMENT', label: 'DATE ENCAISSEMENT DEP\u00d4T GARANTIE', width: 240 },
        { id: 'DDE_SUBVENTION', label: 'DDE DE SUBVENTION', width: 150 },
        { id: 'DATE_VALIDER_SUB', label: 'DATE VALIDER DE SUBVENTION', width: 200 },
        { id: 'FIN_VALIDATION_SUB', label: 'FIN DE VALIDATION SUBVENTION', width: 210 },
        { id: 'MONTANT_PRIME_REGION', label: 'MONTANT PRIME REGION', width: 170 },
        { id: 'DATE_PAIEMENT_PRIME_REGION', label: 'DATE PAIEMENT PRIME REGION', width: 200 },
        { id: 'MONTANT_PRIME_PK', label: 'MONTANT PRIME PK', width: 150 },
        { id: 'DATE_PAIEMENT_PRIME_PK', label: 'DATE PAIEMENT PRIME PK', width: 180 },
        { id: 'MONTANT_MENSUEL_ABT', label: "MONTANT MENSUEL DE L'ABONNEMENT", width: 240 },
        { id: 'MONTANT_TTC_VENTE', label: 'MONTANT TTC DE LA VENTE', width: 190 },
        { id: 'DATE_DEBUT_ABT', label: 'DATE DEBUT ABONNEMENT', width: 180 },
        { id: 'DUREE_ABT', label: "DUREE DE L'ABT", width: 130 },
        { id: 'DATE_FIN_ABT', label: "DATE DE FIN DE L'ABONNEMENT", width: 210 },
        { id: 'MONTANT_PAYE_AU', label: 'MONTANT PAYE AU', width: 150 },
      ],
    },
    {
      name: 'Avancement du dossier',
      colors: COLORS.gris,
      columns: [
        { id: 'DATE_DDE_VT', label: 'DATE DEMANDE DE LA VT', width: 170 },
        { id: 'DATE_PREV_VT', label: 'DATE PREV DE LA VT', width: 150 },
        { id: 'DATE_RETOUR_VT', label: 'DATE RETOUR DE LA VT', width: 160 },
        { id: 'CHARGES_AFFAIRES', label: "CHARGES D'AFFAIRES", width: 150 },
        { id: 'DEMANDE_DP', label: 'DEMANDE DP', width: 110 },
        { id: 'N_DP', label: 'N\u00b0 DP', width: 80 },
        { id: 'RECEPTION_CNO', label: 'RECEPTION CNO', width: 130 },
        { id: 'ETAT_DOSSIER', label: 'ETAT DU DOSSIER', width: 140 },
        { id: 'DATE_PREV_POSE', label: 'DATE PREVISIONNEL DE POSE', width: 190 },
        { id: 'DATE_REELLE_POSE', label: 'DATE REELLE DE POSE', width: 160 },
        { id: 'POSEUR', label: 'POSEUR', width: 100 },
        { id: 'PHOTOS', label: 'PHOTOS', width: 80, align: 'center' },
        { id: 'ATTESTATION_ASSURANCE', label: 'ATTESTATION ASSURANCE', width: 170, align: 'center' },
        { id: 'ELIGIBILITE', label: 'ELIGIBILITE', width: 100 },
        { id: 'DDE_RACC_EDF', label: 'DDE RACC EDF', width: 120 },
        { id: 'N_SUIVI_EDF', label: 'N\u00b0DE SUIVI EDF', width: 130 },
        { id: 'T0_REVENTE', label: 'T0 REVENTE RECU', width: 140 },
        { id: 'N_CRAE', label: 'N\u00b0CRAE', width: 90 },
        { id: 'DDE_SUBVENTION2', label: 'DDE DE SUBVENTION2', width: 160 },
        { id: 'NUMERO_DOSSIER', label: 'NUMERO DOSSIER', width: 140 },
        { id: 'DATE_VALIDER_SUB2', label: 'DATE VALIDER DE SUBVENTION2', width: 210 },
        { id: 'FIN_VALIDATION_SUB2', label: 'FIN DE VALIDATION SUBVENTION2', width: 220 },
        { id: 'DDE_CONSUEL', label: 'DDE CONSUEL', width: 110 },
        { id: 'CONSUEL_VISE', label: 'CONSUEL VISE', width: 120 },
        { id: 'T0_AUTO_CONSO', label: 'TO AUTO CONSO', width: 130 },
        { id: 'DDE_MES_EDF', label: 'DDE DE MES EDF', width: 130 },
        { id: 'MES_EDF', label: 'MES EDF', width: 90 },
      ],
    },
    {
      name: 'Monophase',
      colors: COLORS.bleuClair,
      columns: [
        { id: 'MONO_OND_3KW', label: 'OND 3KW', width: 90 },
        { id: 'MONO_OND_6KW', label: 'OND 6KW', width: 90 },
        { id: 'MONO_BATTERIE', label: 'BATTERIE', width: 90 },
        { id: 'MONO_SMGUARD', label: 'SMGUARD', width: 90 },
      ],
    },
    {
      name: 'Triphase',
      colors: COLORS.bleuFonce,
      columns: [
        { id: 'TRI_OND_3KW', label: 'OND 3KW', width: 90 },
        { id: 'TRI_OND_6KW', label: 'OND 6KW', width: 90 },
        { id: 'TRI_BATTERIE', label: 'BATTERIE', width: 90 },
        { id: 'TRI_SMGUARD', label: 'SMGUARD', width: 90 },
      ],
    },
  ],
}

// BtoB columns
export const BTOB_COLUMNS = {
  frozen: [
    { id: 'COMMERCIAL', label: 'COMMERCIAL', width: 120 },
    { id: 'OBJECTIF', label: 'OBJECTIF', width: 100 },
    { id: 'NOM_PRENOM', label: 'NOM - PRENOM CLIENT', width: 160 },
  ],
  groups: [
    {
      name: 'Progression prospect',
      colors: COLORS.jaune,
      columns: [
        { id: 'PUISSANCE_REALISEE', label: 'PUISSANCE REALISEE', width: 150 },
        { id: 'SIGNE_LE', label: 'SIGNE LE', width: 100 },
        { id: 'CONTRAT_MAINTENANCE', label: 'CONTRAT DE MAINTENANCE', width: 170 },
      ],
    },
    {
      name: 'Coordonnees clients',
      colors: COLORS.bleu,
      columns: [
        { id: 'TYPE_CONTACT', label: 'TYPE DE CONTACT', width: 130 },
        { id: 'ADRESSE_INSTALLATION', label: 'ADRESSE INSTALLATION', width: 170 },
        { id: 'VILLE', label: 'VILLE', width: 100 },
        { id: 'CODE_POSTAL', label: 'CODE POSTALE', width: 110 },
        { id: 'TYPE_PRODUIT', label: 'TYPE DE PRODUIT', width: 130 },
        { id: 'TELEPHONE', label: 'TELEPHONE', width: 110 },
        { id: 'INTERLOCUTEUR', label: 'INTERLOCUTEUR', width: 130 },
      ],
    },
    {
      name: 'Administratif/R\u00e8glement',
      colors: COLORS.vert,
      columns: [
        { id: 'TOTAL_TTC', label: 'TOTAL TTC', width: 100 },
        { id: 'RESTE_ENCAISSER', label: 'RESTE A ENCAISSER', width: 150 },
        { id: 'DEVIS_QUADRA', label: 'DEVIS cr\u00e9\u00e9 sur QUADRA/PENNYLANCE', width: 220 },
        { id: 'DDE_ACOMPTE_1', label: 'DEMANDE D\'ACOMPTE N\u00b01 - SIGNATURE DU DEVIS', width: 280 },
        { id: 'DDE_ACOMPTE_2', label: 'DEMANDE D\'ACOMPTE N\u00b02 - COMMANDE DU MATERIEL', width: 290 },
        { id: 'DDE_ACOMPTE_3', label: 'DEMANDE D\'ACOMPTE N\u00b03 - DEMARRAGE DES TRAVAUX', width: 300 },
        { id: 'DDE_SOLDE', label: 'DEMANDE DE SOLDE', width: 150 },
      ],
    },
    {
      name: 'Avancement du dossier',
      colors: COLORS.rouge,
      columns: [
        { id: 'DATE_DDE_VT', label: 'DATE DEMANDE DE LA VT', width: 170 },
        { id: 'DATE_PREV_VT', label: 'DATE PREVISONNEL VT', width: 150 },
        { id: 'DATE_RETOUR_VT', label: 'DATE RETOUR DE LA VT', width: 160 },
        { id: 'CHARGES_AFFAIRES', label: "CHARGES D'AFFAIRES", width: 150 },
        { id: 'DEMANDE_DP', label: 'DEMANDE DP', width: 110 },
        { id: 'RECEPTION_CNO', label: 'RECEPTION CNO', width: 130 },
        { id: 'ETAT_DOSSIER', label: 'ETAT DU DOSSIER', width: 140 },
        { id: 'DATE_POSE', label: 'DATE DE POSE', width: 120 },
        { id: 'PHOTOS', label: 'PHOTOS', width: 80, align: 'center' },
        { id: 'ATTESTATION_ASSURANCE', label: 'ATTESTATION ASSURANCE', width: 170, align: 'center' },
        { id: 'DDE_RACC_EDF', label: 'DDE RACC EDF', width: 120 },
        { id: 'N_SUIVI_EDF', label: 'N\u00b0DE SUIVI EDF', width: 130 },
        { id: 'T0_RECU', label: 'T0 RECU', width: 90 },
        { id: 'DDE_CONSUEL', label: 'DDE CONSUEL', width: 110 },
        { id: 'CONSUEL_VALIDE', label: 'CONSUEL Valid\u00e9', width: 130 },
        { id: 'MES_EDF', label: 'MES EDF', width: 90 },
      ],
    },
    {
      name: 'Monophase',
      colors: COLORS.mauve,
      columns: [
        { id: 'MONO_OND_3KW', label: 'OND 3KW', width: 90 },
        { id: 'MONO_OND_6KW', label: 'OND 6KW', width: 90 },
        { id: 'MONO_BATTERIE', label: 'BATTERIE', width: 90 },
        { id: 'MONO_SMGUARD', label: 'SMGUARD', width: 90 },
      ],
    },
    {
      name: 'Triphase',
      colors: COLORS.gris,
      columns: [
        { id: 'TRI_OND_3KW', label: 'OND 3 KW', width: 90 },
        { id: 'TRI_OND_6KW', label: 'OND 6 KW', width: 90 },
        { id: 'TRI_STOCKAGE', label: 'STOCKAGE', width: 90 },
        { id: 'TRI_SMGUARD', label: 'SM GUARD', width: 90 },
      ],
    },
  ],
}

// Convert a 0-based column index to a letter (0=A, 1=B, ..., 25=Z, 26=AA)
function getColumnLetter(index) {
  let letter = ''
  let num = index
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter
    num = Math.floor(num / 26) - 1
  }
  return letter
}

// Build a map from column ID to column letter for a given sheet
export function getColumnIdToLetterMap(sheetId) {
  const config = getSheetColumns(sheetId)
  const map = {}
  let index = 0

  config.frozen.forEach(col => {
    map[col.id] = getColumnLetter(index)
    index++
  })

  config.groups.forEach(group => {
    group.columns.forEach(col => {
      map[col.id] = getColumnLetter(index)
      index++
    })
  })

  return map
}

// Get columns config for a sheet
export const getSheetColumns = (sheetId) => {
  switch (sheetId) {
    case 'btoc-comptant':
    case 'btoc-comptant-old':
      return BTOC_COMPTANT_COLUMNS
    case 'btoc-abonnement':
      return BTOC_ABONNEMENT_COLUMNS
    case 'btob':
      return BTOB_COLUMNS
    default:
      return BTOC_COMPTANT_COLUMNS
  }
}

// Font options
export const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New',
  'Trebuchet MS',
  'Impact',
]

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]

// Color presets
export const COLOR_PRESETS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
]
