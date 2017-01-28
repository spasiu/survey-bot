1. get a smooch app secret key and pass it as environment variable API_SECRET

2. pass the secret key id as environment variable API_KEY_ID

3. create a 'message:appUser' webhook to point at https://YOUR_SERVER/response

4. pass the webhook secret as environment variable APPUSER_SECRET

5. create a 'message:appMaker' webhook to point at https://YOUR_SERVER/command

6. pass the webhook secret as environment variable APPMAKER_SECRET

7. pass a Web server URL as environment variable WEBHOOK_URL (this is where completed surveys will be sent)
