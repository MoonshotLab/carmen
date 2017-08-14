require('dotenv').config();

const gulp = require('gulp');

const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const sass = require('gulp-sass');

const browserSync = require('browser-sync').create();
const browserify = require('browserify');
const babelify = require('babelify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const es = require('event-stream');
const rename = require('gulp-rename');

// https://gist.github.com/Fishrock123/8ea81dad3197c2f84366
const gutil = require('gulp-util');
const chalk = require('chalk');

function map_error(err) {
  if (err.fileName) {
    // regular error
    gutil.log(
      chalk.red(err.name) +
        ': ' +
        chalk.yellow(err.fileName.replace(__dirname + '/src/js/', '')) +
        ': ' +
        'Line ' +
        chalk.magenta(err.lineNumber) +
        ' & ' +
        'Column ' +
        chalk.magenta(err.columnNumber || err.column) +
        ': ' +
        chalk.blue(err.description)
    );
  } else {
    // browserify error..
    gutil.log(chalk.red(err.name) + ': ' + chalk.yellow(err.message));
  }

  this.emit('end');
}

gulp.task('sass', function() {
  const processors = [
    autoprefixer({ browsers: ['last 1 version'] }),
    cssnano()
  ];
  return gulp
    .src('./src/scss/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss(processors))
    .pipe(gulp.dest('./public/css'))
    .pipe(browserSync.stream());
});

gulp.task('js', function() {
  const entries = ['./src/js/main.js'];

  const tasks = entries.map(function(entry) {
    const splitEntries = entry.split('/');
    const entryFilename = splitEntries[splitEntries.length - 1];

    return browserify({ entries: [entry] })
      .transform('babelify', { presets: ['es2015'] })
      .bundle()
      .on('error', map_error)
      .pipe(source(entryFilename))
      .pipe(
        rename({
          extname: '.bundle.js'
        })
      )
      .pipe(buffer())
      .pipe(sourcemaps.init())
      .pipe(uglify())
      .pipe(sourcemaps.write('./maps'))
      .pipe(gulp.dest('./public/js'))
      .pipe(browserSync.stream());
  });

  return es.merge.apply(null, tasks);
});

gulp.task('watch', ['sass', 'js'], function() {
  const port = process.env.PORT || 3000;
  browserSync.init({
    proxy: 'localhost:' + port
  });

  gulp.watch('src/scss/**/*.scss', ['sass']);
  gulp.watch('src/js/**/*.js', ['js']);
  gulp.watch('views/**/*.pug').on('change', browserSync.reload);
});

gulp.task('default', ['watch']);
