import { Client, Databases } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const client = new Client();
const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '';
const apiKey = process.env.APPWRITE_API_KEY || '';

if (projectId) {
    client
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);
}

const databases = new Databases(client);

async function setup() {
    try {
        console.log('Creating database ZuvixDB...');
        let dbId;
        try {
            const db = await databases.create('zuvixdb', 'ZuvixDB');
            dbId = db.$id;
        } catch (e: any) {
            if (e.code === 409) {
                console.log('Database already exists. Using zuvixdb');
                dbId = 'zuvixdb';
            } else {
                throw e;
            }
        }

        console.log('Creating collection Tasks...');
        let collectionId;
        try {
            const collection = await databases.createCollection(dbId, 'tasks', 'Tasks');
            collectionId = collection.$id;
        } catch (e: any) {
            if (e.code === 409) {
                console.log('Collection already exists. Using tasks');
                collectionId = 'tasks';
            } else {
                throw e;
            }
        }

        console.log('Creating string attribute taskName...');
        try {
            await databases.createStringAttribute(dbId, collectionId, 'taskName', 255, true);
        } catch (e: any) {
            if (e.code === 409) {
                console.log('Attribute taskName already exists.');
            } else {
                console.error(e);
            }
        }

        console.log('Creating string attribute status...');
        try {
            await databases.createStringAttribute(dbId, collectionId, 'status', 255, true);
        } catch (e: any) {
            if (e.code === 409) {
                console.log('Attribute status already exists.');
            } else {
                console.error(e);
            }
        }

        console.log('Setup completed successfully.');
    } catch (e) {
        console.error('Error during setup:', e);
    }
}

setup();
