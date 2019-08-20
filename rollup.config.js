import typescript from 'rollup-plugin-typescript2'
import { terser } from 'rollup-plugin-terser'
import pkg from './package.json'

const globals = {
  'apollo-cache-inmemory': 'apollo-cache-inmemory',
}

export default [
  {
    input: './src/index.ts',
    external: Object.keys(globals),
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            module: 'esnext',
          },
        },
      }),
      terser(),
    ],
    output: [
      {
        format: 'umd',
        globals,
        file: pkg.unpkg,
        name: 'smart-cache',
      },
      {
        format: 'esm',
        file: pkg.module,
      },
      {
        format: 'cjs',
        file: pkg.main,
      },
    ],
  },
]
