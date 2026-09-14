import { Hono } from 'hono'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { users } from './db/schema'

// 1. Define bindings so Hono knows your environment variable types
type Bindings = {
  DATABASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  try {
    // 2. Initialize the Neon client inside the request handler using context variables
    const sql = neon(c.env.DATABASE_URL)
    
    // 3. Execute a query
    const result = await sql`SELECT NOW();`
    
    return c.json({ 
      success: true, 
      message: "Connected to Neon!", 
      time: result[0] 
    })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})
//test routes
// Route to fetch users
app.get('/users', async (c) => {
  try {
    const client = neon(c.env.DATABASE_URL)
    const db = drizzle(client)

    // Type-safe query using Drizzle
    const allUsers = await db.select().from(users)
    
    return c.json({ success: true, data: allUsers })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Route to create a user
app.post('/users', async (c) => {
  try {
    const body = await c.req.json()
    const client = neon(c.env.DATABASE_URL)
    const db = drizzle(client)

    const newUser = await db.insert(users).values({
      name: body.name,
      email: body.email
    }).returning()

    return c.json({ success: true, data: newUser[0] }, 201)
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

export default app

