import typescript from 'rollup-plugin-typescript2'
import { terser } from 'rollup-plugin-terser'
import pkg from './package.json'

export default [
  {
    input: './src/index.ts',
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
