import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import debug from "debug";
import {
    Player,
    Event,
    Match,
    EventHistory,
    EventHistory,
    sync,
} from "./data";
import { API, JWT } from "./config";
import apiReference from "./api-reference.html";

const ERROR = {
    UNIQUE_CONSTRAINT: "SequelizeUniqueConstraintError",
    FOREIGN_CONSTRAINT: "SequelizeForeignKeyConstraintError",
    INVALID_DATA: "SequelizeValidationError",
};

const MSG = {
    SUCCESS: "SUCCESS",
    CREATED: "CREATED",
    DELETED: "DELETED",
    NAME_TAKEN: "NAME_TAKEN",
    INVALID_DATA: "INVALID_DATA",
    INVALID_REFERENCE: "INVALID_REFERENCE",
    INVALID_LOGIN: "INVALID_LOGIN",
    DB_RESET: "DB_RESET",
    DB_UPDATED: "DB_UPDATED",
    NOT_FOUND: "NOT_FOUND",
};

const logger = debug("api");

function errorHandler(res, next) {
    return function (err) {
        switch (err.name) {
            case ERROR.INVALID_DATA:
                return res.json({ status: MSG.INVALID_DATA });
            case ERROR.UNIQUE_CONSTRAINT:
                return res.json({ status: MSG.NAME_TAKEN });
            case ERROR.FOREIGN_CONSTRAINT:
                return res.json({ status: MSG.INVALID_REFERENCE });
            default:
                return next(err);
        }
    }
}

export function startApi() {
    express()
        .use(cors())
        .use(express.json())
        .use(express.urlencoded())
        .use((req, _res, next) => {
            logger(`${req.method} ${req.url}`);
            next();
        })
        .get("/", (_req, res) => res.sendFile(
            /api-reference.*html/.exec(apiReference)[0],
            { root: __dirname }))
        /* PLAYER ENDPOINTS */
        .get("/player", (_req, res, next) => {
            Player.findAll({ attributes: ['username'] })
                .then(data => res.json({ data }))
                .catch(next);
        })
        .get("/player/:username", async (req, res, next) => {
            const { username } = req.params;
            Player.findOne({
                where: { username },
                include: [{
                    model: EventHistory,
                    include: [Match, Event],
                }]
            })
                .then(process)
                .catch(next);

            function process(player) {
                if (!player) return res.json({ status: MSG.NOT_FOUND });
                const { username, email, EventHistories } = player;
                const data = {
                    username, email,
                    events: EventHistories.map(({ Match, Event }) => ({
                        match: Match.id,
                        event: Event.name,
                        description: Event.description,
                        value: Event.value,
                    })),
                };
                res.json({ data });
            }
        })
        .post("/player", (req, res, next) => {
            const { username, email, password } = req.body;
            // TODO: validation
            Player.create({ username, email, password })
                .then(_ => res.json({ status: MSG.CREATED }))
                .catch(errorHandler(res, next));
        })
        .delete("/player/:username", (req, res, next) => {
            const { username } = req.params;
            Player.destroy({ where: { username } })
                .then(_ => res.json({ status: MSG.DELETED }))
                .catch(next);
        })
        .post("/player/login", async (req, res, _next) => {
            const { username, password } = req.body; 
            if (!username || !password) {
                res.json({ status: MSG.INVALID_DATA });
                return;
            }
            const player = await Player.findOne({ where: { username, password }});
            if (player === null) {
                res.json({ status: MSG.INVALID_LOGIN })
                return;
            }

            const token = jwt.sign({ username }, JWT.SECRET);
            res.json({ status: MSG.SUCCESS, token });
        })
        /* EVENT ENDPOINTS */
        .get("/event", (_req, res, next) => {
            Event.findAll({ attributes: ['name', 'description', 'value'] })
                .then(data => res.json({ data }))
                .catch(next);
        })
        .post("/event", (req, res, next) => {
            const { name, description, value } = req.body;
            // TODO: validation
            Event.create({ name, description, value })
                .then(_ => res.json({ status: MSG.CREATED }))
                .catch(errorHandler(res, next));
        })
        .delete("/event/:name", (req, res, next) => {
            const { name } = req.params;
            Event.destroy({ where: { name } })
                .then(_ => res.json({ status: MSG.DELETED }))
                .catch(next);
        })
        /* MATCH ENDPOINTS */
        .get("/match", (_req, res, next) => {
            Match.findAll({ attributes: ['id', 'duration'] })
                .then(data => res.json({ data }))
                .catch(next);
        })
        .get("/match/:id", (req, res, next) => {
            const { id } = req.params;
            Match.findOne({
                where: { id },
                include: [{
                    model: EventHistory,
                    include: [Player, Event],
                }],
            })
                .then(process)
                .catch(next);

            function process(match) {
                if (!match) return res.json({ status: MSG.NOT_FOUND });
                const data = {
                    matchId: match.id,
                    events: match.EventHistories.map(ev => ({
                        player: ev.PlayerUsername,
                        event: ev.EventName,
                    })),
                };
                res.json({ data });
            }
        })
        .post("/match", async (req, res, next) => {
            const { duration, events } = req.body;
            Match.create({
                duration,
                EventHistories: events.map(({ player, event }) => ({
                    PlayerUsername: player,
                    EventName: event,
                })),
            }, {
                include: [{
                    association: Match.EventHistory,
                    include: [EventHistory.Player, EventHistory.Event],
                }],
            })
                .then(_ => res.json({ status: MSG.CREATED }))
                .catch(errorHandler(res, next));
        })
        .delete("/match/:id", (req, res, next) => {
            const { id } = req.params;
            Match.destroy({ where: { id } })
                .then(_ => res.json({ staus: MSG.DELETED }))
                .catch(next);
        })
        /* DATA ENDPOINTS */
        .get("/db/reset", (_req, res, next) => {
            sync({ force: true })
                .then(_ => res.json({ status: MSG.DB_RESET }))
                .catch(next);
        })
        .get("/db/update", (_req, res, next) => {
            sync({ alter: true })
                .then(_ => res.json({ status: MSG.DB_UPDATED }))
                .catch(next);
        })
        /* ERROR HANDLER */
        .use((err, _req, res, _next) => {
            console.error(err);
            res.status(500).json({ err: err.message });
        })
        .listen(API.PORT, () => {
            logger(`listening on '${API.PORT}'`);
        });
}
