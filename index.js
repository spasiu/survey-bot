'use strict';

const Smooch = require('smooch-core');
const express = require('express');
const bodyParser = require('body-parser');
const superagent = require('superagent');
const survey = require('./survey');

const smooch = new Smooch({
    secret: process.env.API_SECRET,
    keyId: process.env.API_KEY_ID,
    scope: 'app'
});

express()
    .use(logger)
    .use(bodyParser.json())
    .post('/command', validate(process.env.APPMAKER_SECRET), startSurvey)
    .post('/response', validate(process.env.APPUSER_SECRET), responseHandler)
    .use(errorHandler)
    .listen(process.env.PORT || 8000);

function startSurvey(req, res, next) {
    const activate = req.body.messages
        .map(message => message.text)
        .join('\n')
        .indexOf('start the survey') !== -1;

    if (!activate) {
        return res.end();
    }

    const userId = req.body.appUser._id;

    smooch.appUsers.update(userId, {
        properties: Object.assign(req.body.appUser.properties, {
            surveyActive: true,
            surveyIndex: 0
        })
    })
        .then(() => askQuestion(userId, 0))
        .then(() => res.end())
        .catch(next);
}

function responseHandler(req, res, next) {
    const appUser = req.body.appUser;

    // if survey not active, shortcircuit
    if (!appUser.properties.surveyActive) {
        return res.end();
    }

    const index = Number(appUser.properties.surveyIndex);

    // if survey done, deactivate
    if (index === survey.length) {
        return smooch.appUsers.update(appUser._id, {
            properties: Object.assign(appUser.properties, {
                surveyActive: false
            })
        })
            .then(() => smooch.appUsers.sendMessage(appUser._id, {
                text: 'Thanks for answering my questions!',
                role: 'appMaker',
                type: 'text',
                name: 'Survey Bot'
            }))
            .then(() => postResults(appUser))
            .then(() => res.end())
            .catch(next);
    }

    // add user message as response and ask next question
    const text = req.body.messages.map(message => message.text).join('\n');
    if (text.toLowerCase() === 'other') {
        console.log('OTHER');
        return smooch.appUsers.sendMessage(appUser._id, {
            text: 'Please elaborate...',
            role: 'appMaker',
            type: 'text',
            name: 'Survey Bot'
        })
            .then(() => res.end())
            .catch(next);
    }

    appUser.properties[`surveyResponse${index}`] = text;
    appUser.properties['surveyIndex'] = index + 1;

    smooch.appUsers.update(appUser._id, {
        properties: appUser.properties
    })
        .then(() => askQuestion(appUser._id, index + 1))
        .then(() => res.end())
        .catch(next);
}

function askQuestion(userId, index) {
    return smooch.appUsers.sendMessage(userId, {
        text: survey[index],
        role: 'appMaker',
        type: 'text',
        name: 'Survey Bot'
    });
}

function validate(secret) {
    return (req, res, next) => {
        const xApiKey = req.headers['x-api-key'];
        if (xApiKey === secret) {
            return next();
        }

        res.status(401).json({
            error: 'Bumauthorized'
        });
    };
}

function errorHandler(err, req, res, next) {
    res.status(err && err.statusCode || 500).json({ err: err.message });
}

function logger(req, res, next) {
    console.log('-->', req.url, '\n');
    next();
}

function postResults(appUser) {
    return new Promise((resolve, reject) => {
        if (!process.env.WEBHOOK_URL) {
            return Promise.resolve();
        }

        const items = Object.keys(appUser.properties)
        .filter(key => key.indexOf('surveyResponse') !== -1)
        .map(key => {
            const item = {};
            item[key] = appUser.properties[key];
            return item;
        })

        superagent
            .post(url)
            .send({
                smoochId: appUser._id,
                userId: appUser.userId,
                givenName: appUser.givenName,
                surname: appUser.surname,
                email: appUser.email,
                items
            })
            .end((err) => {
                err ? reject(err) : resolve(err)
            });
    });
}
