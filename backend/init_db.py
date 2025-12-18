import asyncpg
import asyncio
import os

async def init_database():
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            company VARCHAR(255),
            title VARCHAR(255),
            enrichment_status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    await conn.execute("""
        INSERT INTO contacts (name, email, company, title) VALUES
        ('John Doe', 'john@example.com', 'Acme Corp', 'CEO'),
        ('Jane Smith', 'jane@techco.com', 'TechCo', 'CTO'),
        ('Bob Johnson', 'bob@startup.io', 'Startup Inc', 'Founder')
        ON CONFLICT DO NOTHING
    """)
    
    await conn.close()
    print("✅ Database initialized!")

if __name__ == "__main__":
    asyncio.run(init_database())
