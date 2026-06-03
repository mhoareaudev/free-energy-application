-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        UNIQUE NOT NULL,
  subject     text        NOT NULL DEFAULT '',
  html_content text       NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

-- Default VT request template
INSERT INTO email_templates (name, subject, html_content)
VALUES (
  'vt_request',
  'Nouvelle demande de VT — {{nom_client}}',
  '<p>Bonjour,</p>
<p>Une nouvelle demande de visite technique vient d''être créée.</p>
<p>
  <strong>Client :</strong> {{nom_client}}<br>
  <strong>Commercial :</strong> {{commercial}}<br>
  <strong>Adresse :</strong> {{adresse}}, {{code_postal}} {{ville}}<br>
  <strong>Téléphone :</strong> {{telephone}}<br>
  <strong>Email :</strong> {{email_client}}<br>
  <strong>Type de contrat :</strong> {{type_contrat}}<br>
  <strong>Puissance envisagée :</strong> {{puissance}} kWc
</p>
<p>Merci de prendre en charge cette demande dès que possible.</p>
<p>Cordialement,<br><strong>Free Energy</strong></p>'
)
ON CONFLICT (name) DO NOTHING;
