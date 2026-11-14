import mongoose from 'mongoose'

let connectionPromise: Promise<typeof mongoose> | undefined

export async function connectMongo(uri: string) {
  if (mongoose.connection.readyState === 1) {
    return mongoose
  }

  if (!uri) {
    throw new Error('MONGODB_URI is not configured')
  }

  connectionPromise ??= mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    })
    .catch((error) => {
      connectionPromise = undefined
      throw error
    })

  return connectionPromise
}

export async function disconnectMongo() {
  connectionPromise = undefined

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

export { mongoose }
export default mongoose
