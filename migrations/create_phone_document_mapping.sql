-- Create table for mapping phone numbers to documents
CREATE TABLE IF NOT EXISTS phone_document_mapping (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    file_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign key to rag_files table
    CONSTRAINT fk_file FOREIGN KEY (file_id) REFERENCES rag_files(id) ON DELETE CASCADE,

    -- Unique constraint to prevent duplicate mappings
    CONSTRAINT unique_phone_file UNIQUE (phone_number, file_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_phone_document_mapping_phone ON phone_document_mapping(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_document_mapping_file_id ON phone_document_mapping(file_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_phone_document_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_phone_document_mapping_updated_at
    BEFORE UPDATE ON phone_document_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_phone_document_mapping_updated_at();

-- Add auto_respond flag to whatsapp_messages table
ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS auto_respond_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS response_message_id TEXT,
ADD COLUMN IF NOT EXISTS response_sent_at TIMESTAMPTZ;

-- Create index on auto_respond_sent for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_auto_respond
ON whatsapp_messages(auto_respond_sent, received_at DESC);

-- Create view to easily see phone number mappings with file details
CREATE OR REPLACE VIEW phone_document_view AS
SELECT
    pdm.id,
    pdm.phone_number,
    pdm.file_id,
    rf.name as file_name,
    pdm.created_at,
    pdm.updated_at
FROM phone_document_mapping pdm
JOIN rag_files rf ON pdm.file_id = rf.id
ORDER BY pdm.phone_number, pdm.created_at DESC;
