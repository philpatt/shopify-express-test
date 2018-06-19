const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce');
const querystring = require('querystring');
const request = require('request-promise')

const apiKey = process.env.SHOPIFY_API_KEY
const apiSecret = process.env.SHOPIFY_API_SECRET
const scope = 'write_products';
const forwardingAddress = 'https://shopify-express.herokuapp.com' //replace this with your HTTPS forwarding address

app.get('/',(req,res) => {
    res.send('Hello World!')
})
app.get('/shopify', (req,res)=>{
    const shop = req.query.shop
    console.log(shop)
    if(shop){
        const state = nonce();
        const redirectUri = forwardingAddress + '/shopify/callback';
        const installUrl = 'https://' + shop + '/admin/oauth/authorize?client_id=' + apiKey + '&scope=' + scope + '&state' + state + '&redirect_uri=' + redirectUri;

        res.cookie('state',state);
        res.redirect(installUrl);
    }else{
        return res.status(400).send('Missing shop paramater')
    }
})
app.get('/shopify/callback', (req,res)=>{
    const { shop, hmac, code, state} = req.query;
    const stateCookie = cookie.parse(req.headers.cookie).state;

    if(state !== stateCookie){
        return res.status(403).send('Request origin cannot be verified')
    }
    if (shop && hmac && code){
        const map = Object.assign({}, req.query);
        delete map['hmac'];
        const message = querystring.stringify(map);
        const generateHash = crypto
            .createHmac('sha256', apiSecret)
            .update(message)
            .digest('hex');
        
        if(generateHash !== hmac){
            return res.status(400).send('HMAC validation failed!');
        }
        res.status(200).send('HMAC validated');//replace with api call
    } else {
        res.status(400).send('Require parameters missing');
    }
})
app.listen(process.env.PORT || 3000, () => {
    console.log('Example app listening on port 3000!');
});