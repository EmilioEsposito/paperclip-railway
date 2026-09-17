"""Verify the public Access gate and direct-origin denial without credentials."""
import urllib.request, urllib.error
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(NoRedirect())
def status(url,headers=None):
    try:
        with opener.open(urllib.request.Request(url,headers=headers or {}),timeout=30) as r: return r.status,r.headers,r.read()
    except urllib.error.HTTPError as e: return e.code,e.headers,e.read()
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
