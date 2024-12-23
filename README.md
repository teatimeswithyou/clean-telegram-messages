# clean telegram messages

## Installing
Clone it or download manually.

```    
git clone https://github.com/teatimeswithyou/clean-telegram-messages.git
cd clean-telegram-messages
```




## Usage
-----

Before working with Telegram’s API, you need to get your own API ID and hash:

1. Follow this [link](https://my.telegram.org/) and login with your phone number.
2. Click under API Development tools.
3. A *Create new application* window will appear. Fill in your application details. There is no need to enter any URL, and only the first two fields (*App title* and *Short name*) can currently be changed later.
4. Click on *Create application* at the end. Remember that your **API hash is secret** and Telegram won’t let you revoke it. Don’t post it anywhere!
5. Specify them in corresponding variables (`api_id` and `api_hash`) in `.env.example`
6. Rename `.env.example` file to `.env`

```
node ./cleanTelegram.js [-s] [-d [id id ...]]


```