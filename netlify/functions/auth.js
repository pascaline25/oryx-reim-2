const { AuthorizationCode } = require('simple-oauth2');

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;
// On utilisera l'URL fournie par Netlify, plus sûr
const siteUrl = process.env.URL || 'http://localhost:8888';

const client = new AuthorizationCode({
  client: {
    id: GITHUB_CLIENT_ID,
    secret: GITHUB_CLIENT_SECRET
  },
  auth: {
    tokenHost: 'https://github.com',
    tokenPath: '/login/oauth/access_token',
    authorizePath: '/login/oauth/authorize'
  },
} );

exports.handler = async (event) => {
  const { code } = event.queryStringParameters;
  const redirect_uri = `${siteUrl}/callback`;

  if (!code) {
    const authorizationUri = client.authorizeURL({
      redirect_uri,
      scope: 'repo,user',
    });
    return {
      statusCode: 302,
      headers: {
        Location: authorizationUri,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };
  }

  try {
    const accessToken = await client.getToken({
      code,
      redirect_uri,
    });

    const { token } = accessToken;

    const response = `<!doctype html><html><head><title>Authenticating...</title></head><body><script>
      (function() {
        const receive = (e) => {
          if (e.origin === '${siteUrl}' && e.data && e.data.auth) {
            window.removeEventListener('message', receive);
            window.opener.postMessage({
              auth: { provider: 'github', token: '${token.access_token}' }
            }, e.origin);
          }
        };
        window.addEventListener('message', receive);
        window.opener.postMessage({ auth: 'success' }, '*');
      })();
    </script></body></html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: response,
    };
  } catch (error) {
    console.error('Access Token Error', error.message);
    return {
      statusCode: 500,
      body: `Access Token Error: ${error.message}`,
    };
  }
};
