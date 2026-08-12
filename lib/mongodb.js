import mongoose from 'mongoose'
import dns from 'dns'

// Node's own DNS resolver sometimes can't resolve the `mongodb+srv://` SRV
// record on Windows/corporate networks even though the OS resolver works fine
// (seen as `querySrv ECONNREFUSED`) — pointing Node at a public resolver fixes it.
dns.setServers(['8.8.8.8', '1.1.1.1'])

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error(
      'Please define the MONGODB_URI environment variable in .env.local'
    )
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✓ MongoDB connected successfully')
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    console.error('✗ MongoDB connection failed:', e.message)
    throw e
  }

  return cached.conn
}

export default connectDB
