
var gulp = require('gulp');
var _ = require('lodash');
var size = require('gulp-size');
var yaml = require('gulp-yaml');
var yml = require('gulp-yml');
var print = require('gulp-print');
var indent = require('gulp-indent');
var stripBom = require('gulp-stripbom');
var removeEmptyLines = require('gulp-remove-empty-lines');
var plumber = require('gulp-plumber');
var jsonEditor = require('gulp-json-editor');
var jsonCombine = require('gulp-jsoncombine');
var safe = require('escape-html');
var marked = require('marked');

var cleanUpInput = jsonEditor(function(json){
    // Tidy up content_type and alt_text
    if(typeof json['content_type'] !== 'undefined'){
        json['content-type'] = json['content_type']
        delete json['content_type']
    }
    if(typeof json['alt_text'] !== 'undefined'){
        json['alt-text'] = json['alt_text']
        delete json['alt_text']
    }
    return json;
});

var validateInput = jsonEditor(function(json){
    if(typeof json['content-type'] === 'undefined'){
        throw "YAML elements must contain a content-type directive"
    }
    return json;
});

var hideHiddenPosts = jsonEditor(function(json){
    if( typeof json['visible'] !== 'undefined' &&
        json['visible'] == false){
        throw "Hiding this blog post." 
    }
    return json;
});

var renderYoutube = jsonEditor(function(json){
    var content_type = json['content-type'];
    var width = 560;
    var height = 315;
    if(content_type === 'youtube'){
        var youtubekey = json['youtube'];
        json['html'] = "\n<iframe width=\""+width+"\" height=\""+height+"\" src=\"//www.youtube.com/embed/"+youtubekey+"\" frameborder=\"0\" allowfullscreen></iframe>"
    }
    return json;
});

var renderImage = jsonEditor(function(json){
    var content_type = json['content-type'];
    if(content_type === 'comic' || content_type === 'image'){
        var url;
        var alt_text = "";
        if(typeof json['comic'] !== 'undefined'){
            url = json['comic'];
        }
        if(typeof json['image'] !== 'undefined'){
            url = json['image'];
        }
        if(typeof url === 'undefined'){
            throw "Articles with content-type '"+content_type+"' must have a '"+content_type+"' element";
        }
        if(typeof json['alt-text'] !== 'undefined'){
            alt_text = json['alt-text']
        }
        json['html'] = "\n<img src=\""+url+"\" alt-text=\""+safe(alt_text)+"\">"
    }
    return json;
});

var renderHtml = jsonEditor(function(json){
    var content_type = json['content-type'];
    if(content_type === 'html'){
        var content = "";
        if(typeof json['content'] !== 'undefined'){
            content = json['content'];
        }
        if(typeof content !== 'undefined'){
            json['html'] = content;
        }
    }
    return json;
});

var renderMarkdown = jsonEditor(function(json){
    var content_type = json['content-type'];
    if(content_type === 'markdown'){
        var content = "";
        if(typeof json['markdown'] !== 'undefined'){
            content = json['markdown'];
        }
        if(typeof json['content'] !== 'undefined'){
            content = json['content'];
        }
        if(typeof content === 'undefined'){
            throw "Articles with content-type '"+content_type+"' must have a '"+content_type+"' element";
        }
        json['html'] = marked(content);
    }
    return json;
});

var renderIrc = jsonEditor(function(json){
    var content_type = json['content-type'];
    if(content_type === 'irc'){
        var content = "";
        if(typeof json['irc'] !== 'undefined'){
            content = json['irc'];
        }
        if(typeof json['content'] !== 'undefined'){
            content = json['content'];
        }
        if(typeof content === 'undefined'){
            throw "Articles with content-type '"+content_type+"' must have a '"+content_type+"' element";
        }
        json['html'] = "";
        // For each line in content, split into <name> content
        // then display like <li><strong class='name'>name</strong> content</li>
        var lines = content.split("\n");
        _(lines).forEach(function(line){
            if(/<\w+>.*/.test(line)){
                var matches = line.match(/<(\w+)>(.*)/);
                var name = safe(matches[1]);
                var message = safe(matches[2]);
                json['html'] += "<li><strong class='name'>"+name+"</strong> "+message+"</li>\n";
            }
        });
    }
    return json;
});

var catchUnrendered = jsonEditor(function(json){
    var content_type = json['content-type'];
    if(typeof json['html'] === 'undefined'){
        throw "I couldn't find a renderer for " + content_type
    }
    return json;
});

gulp.task('default', function(){
    return gulp.src('../Blog/*.yaml')
        .pipe(print())
        .pipe(removeEmptyLines())
        .pipe(stripBom())
        .pipe(plumber())
        .pipe(yml())
        .pipe(cleanUpInput)
        .pipe(validateInput)
        .pipe(hideHiddenPosts)
        .pipe(renderHtml)
        .pipe(renderYoutube)
        .pipe(renderImage)
        .pipe(renderIrc)
        .pipe(renderMarkdown)
        .pipe(catchUnrendered)
        .pipe(gulp.dest('./_json'));
});

gulp.task('index', function(){
    return gulp.src('./_json/*.json')
        .pipe(jsonEditor(function(json){
            delete json['content-type'];
            delete json['content'];
            delete json['visible'];
        }))
        .pipe(jsonCombine("index.json",function(data){
            //console.log(data) 
            return new Buffer(JSON.stringify(data));   
        }))
        .pipe(gulp.dest('./_json'));
});
