import http.client
import json

conn = http.client.HTTPSConnection("dev-nje7dw8s.us.auth0.com")

payload = '{"client_id":"K0k2fX9z5FxkS6SqiDuCh9OFhvoazuOG","client_secret":"0fVtxmJe_URqqllwGO-dfL-bfPWLFespEcxHB3KGJp46Y2pIVhayPwqQ7PdtoQ3A","audience":"https://dev-nje7dw8s.us.auth0.com/api/v2/","grant_type":"client_credentials"}'

headers = {"content-type": "application/json"}

conn.request("POST", "/oauth/token", payload, headers)

res = conn.getresponse()
data = res.read()

j = json.loads(data.decode("utf-8"))

access_token = j["access_token"]


conn = http.client.HTTPSConnection("dev-nje7dw8s.us.auth0.com")

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
