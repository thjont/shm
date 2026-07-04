// Standalone Apps Script Web App — see DEPLOY-BUTTON.md for setup.
// Deployed with "Execute as: Me", so visitors never see this source or the
// GITHUB_TOKEN script property; they only see the page index.html renders.

const OWNER = 'REPLACE_WITH_GITHUB_OWNER';
const REPO = 'REPLACE_WITH_GITHUB_REPO';
const WORKFLOW_FILE = 'update-bgg-cache.yml';
const REF = 'main';
const COOLDOWN_MS = 30 * 1000;

function doGet() {
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

    const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      payload: JSON.stringify({ ref: REF, inputs: { target } }),
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
