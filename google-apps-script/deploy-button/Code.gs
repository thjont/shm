// Standalone Apps Script Web App — see DEPLOY-BUTTON.md for setup.
//
// Deployed as "Execute as: User accessing the web app" + "Anyone with a
// Google account" (no Workspace domain to restrict to), so a Google login is
// required. That alone still allows any Google account on Earth, so
// isAuthorized_() additionally checks the visiting user's email against the
// ALLOWED_EMAILS script property. Visitors never see this source or the
// GITHUB_TOKEN script property; they only see the page index.html renders.

const OWNER = 'REPLACE_WITH_GITHUB_OWNER';
const REPO = 'REPLACE_WITH_GITHUB_REPO';
const WORKFLOW_FILES = {
  prod: 'deploy-prod.yml',
  stage: 'deploy-stage.yml',
};
const REF = 'main';
const COOLDOWN_MS = 30 * 1000;

function isAuthorized_() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) return false;
  const allowed = (PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAILS') || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email);
}

function doGet() {
  if (!isAuthorized_()) {
    return HtmlService.createHtmlOutput('<p>Access denied. Contact the site admin if you should have access.</p>')
      .setTitle('Shiny Hoppy Meeple — Deploy');
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Shiny Hoppy Meeple — Deploy')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function deployProd() {
  return triggerDeploy_('prod');
}

function deployStage() {
  return triggerDeploy_('stage');
}

function triggerDeploy_(target) {
  if (!isAuthorized_()) {
    return { ok: false, message: 'Not authorized.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const cooldownKey = 'lastDeployAt_' + target;
    const last = Number(props.getProperty(cooldownKey) || 0);
    const now = Date.now();
    if (now - last < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return { ok: false, message: `A ${target} deploy was just triggered — wait ${waitSec}s and try again.` };
    }

    const token = props.getProperty('GITHUB_TOKEN');
    if (!token) {
      return { ok: false, message: 'GITHUB_TOKEN script property is not set. Contact the site admin.' };
    }

    const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILES[target]}/dispatches`;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      payload: JSON.stringify({ ref: REF }),
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() === 204) {
      props.setProperty(cooldownKey, String(now));
      return { ok: true, message: `${target} deploy triggered — usually live within a few minutes.` };
    }
    return {
      ok: false,
      message: `GitHub returned an error (HTTP ${response.getResponseCode()}): ${response.getContentText()}`,
    };
  } finally {
    lock.releaseLock();
  }
}
