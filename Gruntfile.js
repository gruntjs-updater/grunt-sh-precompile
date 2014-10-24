/*
 * grunt-precompile
 * 
 *
 * Copyright (c) 2014 jack chen
 * Licensed under the MIT license.
 */

'use strict';
var i18nRegExp = /\{@i18n\s+?key=["](.+?)["]\s*?\/}/gmi,
    dustRegExp = /\.dust$/,
    path = require('path');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('precompile', 'Pre-compile for i18n tag in DUST template', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
        dest: 'build-dev'
      }),
      dest = options.dest;
    
    //Copy source dust file to the same folder but rename the original dust file to the options.ext as the file extension
    this.filesSrc.forEach(function(srcpath, idx){
      var destpath = path.join(dest, srcpath);
      grunt.file.copy(srcpath, destpath, {
        noProcess: false,
        process: processFile
      });
    });
    
    function processFile(content, srcpath){
      
      var isTmpDustFileGenerated = false;
        
      // Though we can use the RegExp object's exec or String.prototype.match method, 
      // however the String.prototype.replace method is much easier and flexible to generate the resouce bundle file
      // no matter this file format is a JAVA property or JSON file
      content = content.replace(i18nRegExp, function(match, key, value, offset, origStr){
        
        if(!isTmpDustFileGenerated){
          grunt.log.writeln('========== Begin of processing the dust file **' + srcpath + '** ==========');
          isTmpDustFileGenerated = true;
        }
        
        grunt.log.writeln('######');
        grunt.log.writeln('match: ' + match);
        grunt.log.writeln('key: ' + key);
        grunt.log.writeln('value: ' + value);
        grunt.log.writeln('######');
        
        return value;
      });
      if(isTmpDustFileGenerated){
        grunt.log.writeln('========== End of processing the dust file **' + srcpath + '** ==========');
      }
      return content;
    }
    
  });

};