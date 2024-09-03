const express = require('express'); 
const session = require('express-session');
const path = require('path');
const pg = require('pg');
const dotenv = require('dotenv');
const PgSession = require('connect-pg-simple')(session);
const cors = require('cors')

const targetsPosition = [
                            { id: 1, name: 'Weedle', position: {x: 0.66 , y: 0.5 } },
                            { id: 2, name: 'Shellder', position: {x: 0.24 , y: 0.95 } },
                            { id: 3, name: 'Butterfree', position: {x: 0.9 , y: 0.43 } },
                        ]

dotenv.config();
const pgPool = new pg.Pool({
    connectionString: 'postgresql://inventory_owner:8j2GeSQrngOR@ep-square-cake-a2i6v0fm.eu-central-1.aws.neon.tech/waldo?sslmode=require'
});

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'dist')));


app.use(express.json({ type: 'application/json', limit: '10mb', charset: 'utf-8' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb', charset: 'utf-8' })); 
app.use(cors())

app.use(session({
    store: new PgSession({
        pool: pgPool, 
        tableName: 'session' 
    }),
    secret: process.env.SESSION_SECRET, 
    resave: false, 
    saveUninitialized: false, 
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, 
    }
}));






app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});



app.post('/startgame', (req, res) => {
    if (!req.session.startTime) {
        req.session.startTime = new Date();
        req.session.targetsFound = [];
        res.status(200).json({message: 'new game started', targetsFound: req.session.targetsFound });
    } else {
        res.status(200).json({message: 'resuming game started on ' + req.session.startTime.toString().substring(0,24), targetsFound: req.session.targetsFound});
    }
});

app.post('/targethit', (req, res) => {
    const hitX = req.body.hitX;
    const hitY = req.body.hitY;
    const hitId = req.body.hitId;
    const target = targetsPosition[hitId - 1];
    const isHit = Math.abs(hitX - target.position.x) < 0.025 && Math.abs(hitY - target.position.y) < 0.025 
    const alreadyFound = req.session.targetsFound.some(t => t.id == hitId);
    console.log(`click at x${hitX} y${hitY}`);
    if (isHit && !alreadyFound) {
        console.log('target hit!')
        req.session.targetsFound.push(target);
        if (req.session.targetsFound.length === 3) {
            req.session.wonGame = true;
            return res.status(200).json({message: 'you found all the targets!', targetsFound: req.session.targetsFound, wonGame: req.session.targetsFound.length === 3 });
        }
        return res.status(200).json({message: 'target found!', targetsFound: req.session.targetsFound, wonGame: req.session.targetsFound.length === 3});

    } else {
        console.log('target missed!');
        return res.status(200).json({message: 'target not correct!', targetsFound: req.session.targetsFound, wonGame:req.session.targetsFound.length === 3});
    }

});

app.get('/leaderboard', async (req, res) => {
    try {
        const { rows } = await pgPool.query("SELECT * FROM leaderboard ORDER BY timeToComplete ASC;");
        return res.status(200).json({message:'leaderboard loaded', leaderboard:rows});
    } catch (error) {
        console.error(error);
            res.status(500).json({error:error});
    }
});

app.post('/leaderboard', async (req, res) => {
    console.log('leaderboard called');
    if (req.session.wonGame) {
        console.log('wincheck successful');
        const timeToComplete = (req.session.startTime - new Date()) / 1000;
        try {
        const {rows} = await pgPool.query("INSERT INTO leaderboard (username, timeToComplete) VALUES ($1,$2)",[req.body.username, timeToComplete.toFixed(2)])
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({error:err});
            }
        })
        console.log('name should have entered leaderboard.');
             }
        catch (error) { 
            console.error(error);
            res.status(500).json({error:error});
        }
    
    } else {
        res.status(403).json({message:'nice try'});
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});



app.listen(port, () => {
    console.log(`Server listening http://localhost:${port}`);
});