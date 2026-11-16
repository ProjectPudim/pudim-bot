/* eslint-disable */
// Runs once, when the MongoDB data volume is empty.
const dbName = process.env.MONGO_DB || 'pudim'

const appDb = db.getSiblingDB(dbName)

if (!appDb.getUser(process.env.MONGO_APP_USERNAME || 'pudim_app')) {
  appDb.createUser({
    user: process.env.MONGO_APP_USERNAME || 'pudim_app',
    pwd: process.env.MONGO_APP_PASSWORD || '',
    roles: [{ role: 'readWrite', db: dbName }],
  })
}

if (!appDb.getUser(process.env.MONGO_BACKUP_USERNAME || 'pudim_backup')) {
  appDb.createUser({
    user: process.env.MONGO_BACKUP_USERNAME || 'pudim_backup',
    pwd: process.env.MONGO_BACKUP_PASSWORD || '',
    roles: [
      { role: 'read', db: dbName },
      { role: 'backup', db: 'admin' },
    ],
  })
}

if (!appDb.getCollectionNames().includes('_init')) {
  appDb.createCollection('_init')
  appDb._init.insertOne({ createdAt: new Date() })
}
