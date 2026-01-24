import CryptoJS from 'crypto-js'

// Get encryption key from environment
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
  return key
}

// Encrypt sensitive data (like Supabase service role key)
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  return CryptoJS.AES.encrypt(plaintext, key).toString()
}

// Decrypt encrypted data
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const bytes = CryptoJS.AES.decrypt(ciphertext, key)
  return bytes.toString(CryptoJS.enc.Utf8)
}
