import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'graphql'
import { constructTypeFieldMap } from './codegen'

const [src, dest] = process.argv.slice(2)

if (!src || !dest) {
  throw new Error('Please provide src path and dest path')
}

const CWD = process.cwd()
const srcPath = path.resolve(CWD, src)
const destPath = path.resolve(CWD, dest)

fs.writeFileSync(
  destPath,
  constructTypeFieldMap(parse(fs.readFileSync(srcPath, 'utf8')))
)
