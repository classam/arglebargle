
var gulp = require('gulp');
var _ = require('lodash');
var yml = require('gulp-yml');
var print = require('gulp-print');
var stripBom = require('gulp-stripbom');
var removeEmptyLines = require('gulp-remove-empty-lines');
var plumber = require('gulp-plumber');
var jsonEditor = require('gulp-json-editor');
var jsonCombine = require('gulp-jsoncombine');
var argyle = require('./argyle');
var del = require('del');
var rename = require('gulp-rename');
var ignore = require('gulp-ignore');
var handlebars = require('gulp-compile-handlebars');
var handlebarsHelpers = require('diy-handlebars-helpers');

gulp.task('clean', function(){
    del('target'); 
});

gulp.task('compile_posts', function(cb){
    return gulp.src('./source/posts/*.yaml')
        .pipe(print())
        .pipe(removeEmptyLines())
        .pipe(stripBom())
        .pipe(plumber())
        .pipe(yml())
        .pipe(argyle.appendFileinfo())
        .pipe(argyle.tidyInput())
        .pipe(argyle.render())
        .pipe(gulp.dest('./target/json/posts'));
});

gulp.task('concatenate_posts', ['compile_posts'], function(){
    return gulp.src('./target/json/posts/*.json')
        .pipe(jsonCombine("posts.json",function(data){
            return new Buffer(JSON.stringify(data));   
        }))
        .pipe(jsonEditor(function(json){return json;}))
        .pipe(gulp.dest('./target/json/'));
});

gulp.task('compile_config', function(){
    return gulp.src('./source/config.yaml')
        .pipe(yml())
        .pipe(rename("config.json"))
        .pipe(gulp.dest('./target/json/'));
});

gulp.task('compile_index', ['concatenate_posts'], function(){
    return gulp.src('target/json/posts.json')
        .pipe(argyle.buildIndex())
        .pipe(rename("index.json"))
        .pipe(gulp.dest('target/json/'));
});

gulp.task('compile_categories', ['concatenate_posts'], function(){
    return gulp.src('target/json/posts.json')
        .pipe(argyle.buildCategories())
        .pipe(rename("categories.json"))
        .pipe(gulp.dest('target/json/'));
});

gulp.task('concatenate_master', ['compile_config', 'compile_index', 'compile_categories'], function(){
    return gulp.src('target/json/*.json') 
        .pipe(ignore.include(function(file){
            return (file.path.indexOf("config.json") > -1 ||
                    file.path.indexOf("index.json") > -1 ||
                    file.path.indexOf("categories.json") > -1);
        }))
        .pipe(jsonCombine("master.json",function(data){
            return new Buffer(JSON.stringify(data));   
        }))
        .pipe(jsonEditor(function(json){return json;}))
        .pipe(gulp.dest('./target/json/'));
});

gulp.task('partials', ['concatenate_master'], function(cb){
    return gulp.src('target/json/master.json')
        .pipe(jsonEditor(function(json){
            gulp.src('./source/theme/partials/*.handlebars')
            .pipe(print())
            .pipe(handlebars(json, {
                'helpers': handlebarsHelpers, 
            }))
            .pipe(gulp.dest('./target/partials/'))
            return json;
            cb();
        }))
});

gulp.task('pages_html', ['partials'], function(){
    return gulp.src('target/json/master.json')
        .pipe(jsonEditor(function(master){
            gulp.src('target/json/posts/*.json')
                .pipe(jsonEditor(function(post){
                    var post = argyle.addMetadataToPost(post, master);
                    gulp.src('source/theme/single.handlebars')
                        .pipe(handlebars(post, {
                            'batch':['./target/partials'],
                            'helpers': handlebarsHelpers, 
                        }))
                        .pipe(rename(post.id + ".html"))
                        .pipe(gulp.dest('./target'))
                        .pipe(print())
                    return {};
                }));
            return {};
        }))
});

gulp.task('rss', ['concatenate_master'], function(){
    return gulp.src('target/json/master.json')
        .pipe(jsonEditor(function(master){
            gulp.src('source/theme/rss.handlebars')
                .pipe(handlebars(argyle.addMetadataToMaster(master), {
                    'helpers': handlebarsHelpers, 
                }))
                .pipe(rename("rss.xml"))
                .pipe(gulp.dest('./target'))
                .pipe(print())
            return {};
        }));
});

gulp.task('index_html', ['partials'], function(){
    return gulp.src('target/json/master.json')
        .pipe(jsonEditor(function(master){
            gulp.src('source/theme/index.handlebars')
                .pipe(handlebars(argyle.addMetadataToMaster(master), {
                    'batch':['./target/partials'],
                    'helpers': handlebarsHelpers, 
                }))
                .pipe(rename("index.html"))
                .pipe(gulp.dest('./target'))
                .pipe(print())
            return {};
        }));
});

gulp.task('default', ['index_html', 'pages_html', 'rss'], function(){
    // TODO
});
