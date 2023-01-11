# Quadratic Uses Auth0 For Auth

### There are some customizations that make the Auth0 experience better for end users

**Set Descriptions (python API calls)**

```python
import http.client
import json

DOMAIN = "dev.us.auth0.com"
CLIENT_ID = "CLIENT_ID"
CLIENT_SECRET = ""
AUDIENCE = "https://{}/api/v2/".format(DOMAIN)


# Get access_token
conn = http.client.HTTPSConnection(DOMAIN)
payload = '{"client_id":{},"client_secret":{},"audience":{},"grant_type":"client_credentials"}'.format(CLIENT_ID, CLIENT_SECRET, AUDIENCE)

headers = {"content-type": "application/json"}

conn.request("POST", "/oauth/token", payload, headers)

res = conn.getresponse()
data = res.read()

j = json.loads(data.decode("utf-8"))

access_token = j["access_token"]

conn = http.client.HTTPSConnection("DOMAIN")

payload = {
    "login": {"description": "Login to Quadratic."},
    "signup": {"description": "Signup for Quadratic."},
}

headers = {
    "content-type": "application/json",
    "authorization": "Bearer {}".format(access_token),
}

conn.request(
    "PUT",
    "/api/v2/prompts/login/custom-text/en",
    str(json.dumps(payload)),
    headers,
)

res = conn.getresponse()
data = res.read()

print(data.decode("utf-8"))
```
