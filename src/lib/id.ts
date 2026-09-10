import { customAlphabet } from 'nanoid'

// url-safe, no lookalikes — these ids end up in a file a human might read
const alphabet = '23456789abcdefghijkmnpqrstuvwxyz'
const gen = customAlphabet(alphabet, 12)

export const id = (): string => gen()
