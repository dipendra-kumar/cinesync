import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/background.ts', 'src/content.ts', 'src/popup.ts'],
  bundle: true,
  outdir: '.',
  target: 'chrome116',
  format: 'iife',
  sourcemap: watch ? 'inline' : false,
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('CineSync watching for changes…');
} else {
  await esbuild.build(config);
  console.log('CineSync built!');
}
