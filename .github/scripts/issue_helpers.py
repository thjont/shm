import os, re, subprocess, sys


def extract(label, body=None):
    if body is None:
        body = os.environ['ISSUE_BODY']
    m = re.search(rf'### {re.escape(label)}\n\n(.*?)(?=\n### |\Z)', body, re.DOTALL)
    if not m:
        return ''
    v = m.group(1).strip()
    return '' if v == '_No response_' else v


def comment(issue_number, msg):
    subprocess.run(['gh', 'issue', 'comment', issue_number, '--body', msg], check=True)


def set_output(key, value):
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write(f'{key}={value}\n')


def validate_slug(issue_number, slug, hint=None):
    if not re.match(r'^[a-z0-9][a-z0-9-]*$', slug):
        print(f'::error::Invalid slug: {slug!r}')
        msg = f'Invalid slug: `{slug}`.'
        msg += f' {hint}' if hint else ' Use lowercase letters, numbers, and hyphens only.'
        comment(issue_number, msg)
        sys.exit(1)
