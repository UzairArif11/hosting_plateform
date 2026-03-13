const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'emails');

/**
 * Load an email template and substitute variables
 * Variables in templates use {{variableName}} syntax
 */
function loadTemplate(templateName, variables = {}) {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
    
    if (!fs.existsSync(filePath)) {
      logger.warn(`[EMAIL] Template not found: ${templateName}, using fallback`);
      return generateFallback(templateName, variables);
    }

    let html = fs.readFileSync(filePath, 'utf8');

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value ?? '');
    }

    return html;
  } catch (error) {
    logger.error(`[EMAIL] Failed to load template ${templateName}:`, error.message);
    return generateFallback(templateName, variables);
  }
}

/**
 * Fallback plain HTML if template file is missing
 */
function generateFallback(templateName, vars) {
  const platformName = vars.platformName || process.env.PLATFORM_NAME || 'RevsCore';
  const userName = vars.userName || 'User';
  const renewUrl = vars.renewUrl || `${process.env.FRONTEND_URL}/dashboard/billing`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>${platformName}</h2>
      <p>Hi ${userName},</p>
      <p>This is an automated notification regarding your account (${templateName}).</p>
      <p><a href="${renewUrl}">Go to Dashboard</a></p>
    </div>`;
}

module.exports = { loadTemplate };
