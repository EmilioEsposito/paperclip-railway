"""Verify the public Access gate and direct-origin denial without credentials."""
import subprocess
from email.parser import Parser

def status(url,headers=None):
    cmd=['curl','--silent','--show-error','--max-time','30','--include',url]
    for k,v in (headers or {}).items(): cmd.extend(['--header',k+': '+v])
    r=subprocess.run(cmd,capture_output=True,check=True)
    raw=r.stdout
    # Discard an optional CONNECT proxy response without logging cookies.
    while raw.startswith(b'HTTP/'):
        head,body=raw.split(b'\r\n\r\n',1)
        first,rest=head.split(b'\r\n',1)
        code=int(first.split()[1])
        if code==200 and b'Connection established' in first:
            raw=body
            continue
        return code,Parser().parsestr(rest.decode()),body
    raise AssertionError('No HTTP response')
origin='https://paperclip-production-b99f.up.railway.app'
for path in ['/','/auth','/api/companies','/api/health','/api/auth/get-session']:
    code,_,_=status(origin+path)
    assert code==403,(path,code)
    print('Origin denies',path,code)
code,_,_=status(origin+'/',{'Cf-Access-Jwt-Assertion':'forged','Cf-Access-Authenticated-User-Email':'emilio@serniacapital.com'})
assert code==403
print('Forged identity headers rejected')
code,_,body=status(origin+'/_health')
assert code==200 and body==b'ok'
print('Data-free readiness healthy')
for path in ['/','/api/companies']:
    code,headers,_=status('https://paperclip.serniaventures.com'+path)
    assert code==302 and headers.get('Location','').startswith('https://espo412.cloudflareaccess.com/')
    print('Cloudflare challenges anonymous request:',path)
