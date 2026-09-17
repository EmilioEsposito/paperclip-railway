"""Generate signing keys once and transfer to Railway over stdin; never print values."""
import json, os, pathlib, secrets, subprocess
p = pathlib.Path('.private/signing.json')
p.parent.mkdir(mode=0o700, exist_ok=True)
if not p.exists():
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump({k: secrets.token_hex(32) for k in ('BETTER_AUTH_SECRET', 'PAPERCLIP_AGENT_JWT_SECRET', 'PAPERCLIP_TOOL_ACTION_SIGNING_SECRET')}, f)
payload = {'input': {'projectId': '9de89a8c-9607-4ab9-84f7-676d2b028f7c', 'environmentId': 'facda68b-72f0-4b63-bf10-56824ea39d00', 'serviceId': '995f5249-14bc-432d-bae5-f2564166cc89', 'skipDeploys': True, 'variables': json.loads(p.read_text())}}
env = dict(os.environ, RAILWAY_CALLER='skill:use-railway@1.4.0', RAILWAY_AGENT_SESSION='paperclip-pilot-20260917')
r = subprocess.run(['railway', 'api', 'mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }', '--variables', '@-'], input=json.dumps(payload), text=True, capture_output=True, env=env)
try:
    assert r.returncode == 0 and json.loads(r.stdout)['data']['variableCollectionUpsert'] is True
except Exception:
    raise SystemExit('Secret transfer did not confirm success; raw provider response suppressed.')
print('Set signing keys on Paperclip; values suppressed.')
