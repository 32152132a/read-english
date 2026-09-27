import { join } from 'node:path'
import { createRequire } from 'node:module'

const pluginsDirectory = process.env.UNI_HBUILDERX_PLUGINS

const require = createRequire(import.meta.url)
const { default: uni } = require(
  join(pluginsDirectory, 'uniapp-cli-vite/node_modules/@dcloudio/vite-plugin-uni')
)

export default {
  plugins: [uni()],
  resolve: {
    // Keep the Web runtime and its internal helpers from the same HBuilderX bundle.
    alias:
      process.env.UNI_PLATFORM === 'h5' && pluginsDirectory
        ? [
            {
              find: /^@vue\/shared$/,
              replacement: join(
                pluginsDirectory,
                'uniapp-cli-vite/node_modules/@vue/shared/dist/shared.esm-bundler.js'
              ),
            },
          ]
        : [],
  },
}
