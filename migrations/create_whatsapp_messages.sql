-- Create table for WhatsApp webhook messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    channel TEXT NOT NULL,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    content_type TEXT,
    content_text TEXT,
    sender_name TEXT,
    event_type TEXT,
    is_in_24_window BOOLEAN DEFAULT false,
    is_responded BOOLEAN DEFAULT false,
    raw_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on message_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON whatsapp_messages(message_id);

-- Create index on from_number for user queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from_number ON whatsapp_messages(from_number);

-- Create index on received_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_received_at ON whatsapp_messages(received_at DESC);

-- Create index on event_type
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_event_type ON whatsapp_messages(event_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_whatsapp_messages_updated_at
    BEFORE UPDATE ON whatsapp_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_whatsapp_messages_updated_at();
