var _ = require('lodash');
var jsbeautify = require('js-beautify').js_beautify;
var jsonEditor = require('gulp-json-editor');
var safe = require('escape-html');
var marked = require('marked');
var through = require('through2');
var PluginError = require('gulp-util').PluginError;

module.exports = {
    cleanUpInput:function(){
        return jsonEditor(function(json){
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
        })
    },
    appendFileinfo:function(){
        return through.obj(function(file, encoding, callback){
            if(file.isNull()){
                this.push(file);
                return callback();
            }
            if(file.isStream()){
                this.emit('error', new PluginError('argyle', 'Streaming is not supported'));
                return callback();
            }
            try {
                var utf8 = file.contents.toString('utf8');
                var json = JSON.parse(utf8);
                json['path'] = file.path;
                json['base'] = file.base;
                json['filename'] = file.path.replace(/^.*[\\\/]/, '');
                json['id'] = json['filename'].slice(0, -5);
                file.contents = new Buffer(JSON.stringify(json));
            }
            catch (err) {
                this.emit('error', new PluginError('argyle', err));
            }
            this.push(file);
            callback();
        });
    },
    validateInput:function(){
        return jsonEditor(function(json){
            if(typeof json['content-type'] === 'undefined'){
                throw "YAML elements must contain a content-type directive"
            }
            return json;
        });
    },
    hideHiddenPosts:function(){
        return jsonEditor(function(json){
            if( typeof json['visible'] !== 'undefined' &&
                json['visible'] == false){
                throw "Hiding this blog post." 
            }
            return json;
        });
    },
    renderYoutube:function(){
        return jsonEditor(function(json){
            var content_type = json['content-type'];
            var width = 560;
            var height = 315;
            if(content_type === 'youtube'){
                var youtubekey = json['youtube'];
                json['html'] = "\n<iframe width=\""+width+"\" height=\""+height+"\" src=\"//www.youtube.com/embed/"+youtubekey+"\" frameborder=\"0\" allowfullscreen></iframe>"
            }
            return json;
        });
    },
    renderImage:function(){
        return jsonEditor(function(json){
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
    },
    renderHtml:function(){
        return jsonEditor(function(json){
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
    },
    renderMarkdown:function(){
        return jsonEditor(function(json){
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
    },
    renderIrc:function(){
        return jsonEditor(function(json){
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
    },
    catchUnrendered: function(){
        return jsonEditor(function(json){
            var content_type = json['content-type'];
            if(typeof json['html'] === 'undefined'){
                throw "I couldn't find a renderer for " + content_type
            }
            return json;
        });
    },
    stripNonIndexProperties: function(){
        return jsonEditor(function(json){
            newjson = {};
            newjson['created'] = json['created'];
            newjson['categories'] = json['categories'];
            newjson['title'] = json['title'];
            return newjson;
        })
    }

};
