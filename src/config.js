import dotenv from "dotenv";
dotenv.config();

export const DB = {
	URL: process.env['DATABASE_URL'],
};

export const API = {
    PORT: process.env['PORT'] ?? 8088,
};

export const JWT = {
    SECRET: process.env['JWT_SECRET'] ?? "secret",
}
