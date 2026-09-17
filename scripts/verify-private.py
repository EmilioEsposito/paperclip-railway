"""Verify live authentication without printing credentials or sessions."""
import http.cookiejar, json, pathlib, secrets, urllib.request, urllib.error
base = 'https://paperclip-production-b99f.up.railway.app'
def call(opener, path, data=None):
    req=urllib.request.Request(base+path, data=json.dumps(data).encode() if data is not None else None, headers={'Content-Type':'application/json','Origin':base})
    try:
        with opener.open(req, timeout=30) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)
anon=urllib.request.build_opener()
status,health=call(anon,'/api/health')
assert status==200, f'Health HTTP {status}'
print('Health: 200')
status,_=call(anon,'/api/companies')
assert status in (401,403), f'Anonymous data access HTTP {status}'
print('Anonymous company access denied:', status)
status,rejection=call(anon,'/api/auth/sign-up/email',{'email':'signup-probe@example.com','password':secrets.token_urlsafe(32),'name':'Signup probe'})
assert status in (400,403), f'Signup HTTP {status}'
assert rejection.get('code') == 'EMAIL_PASSWORD_SIGN_UP_DISABLED'
print('Public signup explicitly disabled:', status)
owner=json.loads(pathlib.Path('.private/owner.json').read_text())
jar=http.cookiejar.CookieJar()
session=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
status,_=call(session,'/api/auth/sign-in/email',owner)
assert status==200, f'Owner login HTTP {status}'
assert any(c.secure for c in jar), 'No secure session cookie'
status,result=call(session,'/api/companies')
assert status==200, f'Authenticated access HTTP {status}'
print('Owner login and authenticated company access: 200; secure session cookie confirmed')
status,_=call(session,'/api/auth/sign-out',{})
assert status==200
print('Verification session signed out')
