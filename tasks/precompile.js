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
    jsRegExp = /\.js$/,
    propsRegExp = /\.properties$/,
    multiLineRegExp = /\\\r?\n\s*/g,
    missingKeyRegExp = /(\{\{.*\}\})/,
    path = require('path'),
    sep = path.sep,
    eol = require('os').EOL,
    file = require('fs'),
    util = {};

util = {
    endsWith: function(str, suffix) {
        return str.substring(str.length - suffix.length, str.length) === suffix;
    },
    _convertStringIfTrue: function (original) {
        var str;
        if (original && typeof original === "string") {
            str = original.toLowerCase().trim();
            return (str === "true" || str === "false") ? (str === "true") : original;
        }
        return original;
    },
    convertPropsToJson: function (text) {
        var jsonObj = {},
            _this = this;
        if (text && text.length) {
            // handle multi-line values terminated with a backslash
            text = text.replace(multiLineRegExp, '');
            text.split(/\r?\n/g).forEach(function (line) {
                var props,
                    name,
                    val;
                line = line.trim();
                if (line && line.indexOf("#") !== 0 && line.indexOf("!") !== 0) {
                    props = line.split(/\=(.+)?/);
                    name = props[0] && props[0].trim();
                    val = props[1] && props[1].trim();
                    jsonObj[name] = _this._convertStringIfTrue(val);
                }
            });
        }
        return jsonObj;
    },
    getLocaleFromFilePath: function(filePath, localesRootPath){
        var relativePath = path.relative(localesRootPath, filePath),
            locale = relativePath.split(sep)[0] + '-' + relativePath.split(sep)[1];

          return locale;
    },
    getNormalizedLocale: function(country, lang) {
        country = country || this.__defaultCountry();
        lang = lang || this.__defaultLanguage();

        return ('' + country).toUpperCase() + '-' + ('' + lang).toLowerCase();
    },
    __defaultLocale: function(country, lang) {
        var countryCode = this.__defaultCountry(country),
            langCode = this.__defaultLanguage(lang);

        return countryCode + '-' + langCode;
    },
    __defaultCountry: function(countryCode) {
        countryCode = countryCode && ('' + countryCode).toUpperCase() || 'US';
        return countryCode;
    },
    __defaultLanguage: function(languageCode) {
        languageCode = languageCode && ('' + languageCode).toLowerCase() || 'en';
        return languageCode;
    },
    extend: function(target){
        var sources = [].slice.call(arguments, 1);
        sources.forEach(function (source) {
            for (var prop in source) {
                if(Object.hasOwnProperty.call(source, prop)){
                    target[prop] = source[prop];   
                }
            }
        });
        return target;
    },
    isEmpty: function(val){
        return (typeof val === 'undefined') || val === null;
    },
    createSpace: function(num){
        // Default create 4 spaces
        num = (num || 4) + 1;
        return new Array(num).join(' ');
    }

};



module.exports = function(grunt) {

    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    grunt.registerMultiTask('precompile', 'Pre-compile for i18n tag in DUST template', function() {
         // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({
                templatesFolder: 'templates',
                scriptsFolder: 'scripts',
                localesFolder: 'locales',
                commonPropsSrc: ['common/**/*.properties'],
                scriptsPropsSrc: ['scripts/**/*.properties'],
                scriptsPropsFileName: 'i18nPropsForScripts'
            }),
            templatesFolder = options.templatesFolder,
            scriptsFolder = options.scriptsFolder,
            localesFolder = options.localesFolder,
            localesRootPath = options.localesRootPath,
            commonPropsSrc = options.commonPropsSrc,
            scriptsPropsSrc = options.scriptsPropsSrc,
            scriptsPropsFileName = options.scriptsPropsFileName,
            scriptsPropsTemplateFile = grunt.file.expand(options.scriptsPropsTemplate)[0],
            scriptsPropsJsonList = [],  // contains the locale - scriptsPropsJson, similar with the variable commonPropsJsonList
            commonPropsJsonList = [],   // contains the locale - commonPropsJson, e.g. [{'DE-de': {'k1':'v1', 'k2':'v2'}}, {'GB-en': {'k1':'v1gb', 'k2':'v2gb'}}]
            localesList = [],           // locales list will be an array containing normalized Country-lang code list, e.g. ['DE-de', 'US-en', 'GB-en'];
            templatesList = [];// an array containing all of dust for each locale, e.g. ['build-dev/resources/shape/locales/DE/de/templates/account_charges.dust','build-dev/resources/shape/locales/GB/en/templates/account_charges.dust','build-dev/resources/shape/locales/US/en/templates/account_charges.dust','build-dev/resources/shape/locales/DE/de/templates/breadCrumbs.dust',...];

        // To get all of the available locales list and commonPropsJsonList
        grunt.verbose.writeln('============localesRootPath=======', localesRootPath);
        file.readdirSync(localesRootPath).forEach(function(country, idx) {
            var countryPath = path.join(localesRootPath, country),
                locale = '',
                commonLocalePropsSrc = [],
                commonLocalePropsJson = {},
                commonPropsJson = {},
                scriptsLocalePropsSrc = [],
                scriptsLocalePropsJson = {},
                scriptsPropsJson = {};

            file.readdirSync(countryPath).forEach(function(lang, idx) {
                locale = util.getNormalizedLocale(country, lang);
                if (localesList.indexOf(locale) == -1) {
                    
                    // put the locale to the localesList array and reset the commonLocalePropsSrc which will hold all the common properties for the specified loale
                    localesList.push(locale);
                    commonLocalePropsSrc = [];
                    scriptsLocalePropsSrc = [];
                    /*
                    ** constructure the commonPropsJsonList for each locale
                    */
                    // Re-constructure the commonPropsSrc, actually this is an array, but we need to re-build the common properties file pattern
                    // Since by default, all file paths are relative to the `Gruntfile`, please have a reference: 
                    // http://gruntjs.com/api/grunt.file#grunt.file.setbase and http://gruntjs.com/api/grunt.file#grunt.file.expand
                    commonLocalePropsSrc = commonPropsSrc.map(function(commonPropsFilePattern, idx){
                        return path.join(localesRootPath, country, lang, commonPropsFilePattern);
                    });

                    var commonPropsFileArr = grunt.file.expand(commonLocalePropsSrc);

                    commonPropsFileArr.forEach(function(file, idx){
                        var jsonObj = grunt.file.exists(file) ? util.convertPropsToJson(grunt.file.read(file)) : {};
                        commonLocalePropsJson = util.extend({}, commonLocalePropsJson, jsonObj);
                    });

                    commonPropsJson[locale] = commonLocalePropsJson;
                    commonPropsJsonList.push(commonPropsJson);

                    // logic to handle the scripts properties file, generate a combiled properties file for each locale
                    // then convert it to a JS file conform to the require js syntax
                    scriptsLocalePropsSrc = scriptsPropsSrc.map(function(scriptsPropsFilePattern, idx){
                        return path.join(localesRootPath, country, lang, scriptsPropsFilePattern);
                    });

                    var scriptsPropsFileArr = grunt.file.expand(scriptsLocalePropsSrc);

                    scriptsPropsFileArr.forEach(function(file, idx){
                        var jsonObj = grunt.file.exists(file) ? util.convertPropsToJson(grunt.file.read(file)) : {};
                        scriptsLocalePropsJson = util.extend({}, scriptsLocalePropsJson, jsonObj);
                    });

                    scriptsPropsJson[locale] = scriptsLocalePropsJson;
                    scriptsPropsJsonList.push(scriptsPropsJson);
                    
                }
            });

        });

        grunt.log.subhead('[precompile] ==== available locale list is: ', localesList);
        grunt.log.writeln('[precompile] ==== commonPropsJsonList is: ', commonPropsJsonList);
        grunt.log.writeln('[precompile] ==== scriptsPropsJsonList is: ', scriptsPropsJsonList);

        // Combile commonPropsJson with scriptsPropsJson to generate a new sripts properties for each locale
        localesList.forEach(function(locale, idx){
            var commonPropsJson = {},
                scriptsPropsJson = {},
                content = '',
                country = locale.split('-')[0].toUpperCase(),
                lang = locale.split('-')[1].toLowerCase(),
                destPath = path.join(localesRootPath, country, lang, scriptsFolder, scriptsPropsFileName + '.js');

            commonPropsJsonList.every(function(obj){
                if(obj[locale]){
                    commonPropsJson = obj[locale];
                    return false;
                }
                else{
                    return true;
                }
            });

            scriptsPropsJsonList.every(function(obj){
                if(obj[locale]){
                    scriptsPropsJson = obj[locale];
                    return false;
                }
                else{
                    return true;
                }
            });

            scriptsPropsJson = util.extend({}, commonPropsJson, scriptsPropsJson);
            
            grunt.verbose.subhead('**** scriptsPropsJson', scriptsPropsJson);

            content = grunt.file.read(scriptsPropsTemplateFile);
            // Pretty print the JSON file format
            scriptsPropsJson = JSON.stringify(scriptsPropsJson, null, 4);
            scriptsPropsJson = scriptsPropsJson.replace(new RegExp(eol + util.createSpace(4), "mg"), eol + util.createSpace(8));
            scriptsPropsJson = scriptsPropsJson.replace("}", util.createSpace(4) + "}");

            content = content.replace("{{i18nPropsJson}}", scriptsPropsJson);
            grunt.file.write(destPath, content);
            
        });

        // Copy all the source dust template files to each targeted locale folder.
        this.filesSrc.forEach(function(srcpath, idx) {
            var destpath = '',
                localeFolder = 'US/en',
                templatespath = srcpath.split(sep).slice(1).join(sep);

            grunt.verbose.writeln('[precompile] ==== src template path: ', srcpath);

            localesList.forEach(function(locale, idx) {
                localeFolder = locale.split('-').join(sep);
                destpath = path.join(localesRootPath, localeFolder, templatespath);

                templatesList.push(destpath);

                grunt.file.copy(srcpath, destpath, {
                    noProcess: false
                });

            });

        });

        /*
        ** Handle the {@i18n} tag in each dust template file in each locale, replace it with associated localized properties file
        ** Or show the missing key error message if the key is missing
        */
        // grunt.log.writeln('=========templatesList', templatesList);
        templatesList.map(function(filepath){
            var dustFilePath = filepath,
                dustFileContent = grunt.file.read(dustFilePath),
                propsFilePath = dustFilePath.replace(dustRegExp, '.properties'),
                isPropsExists = grunt.file.exists(propsFilePath),
                propsJSON = isPropsExists ? util.convertPropsToJson(grunt.file.read(propsFilePath)) : {};

            return {
                dustFilePath: dustFilePath,
                dustFileContent: dustFileContent,
                propsFilePath: propsFilePath,
                propsJSON: propsJSON,
                commonPropsJsonList: commonPropsJsonList
            };

        }).forEach(function(obj, idx){
            var content = obj.dustFileContent,
                dustFilePath = obj.dustFilePath,
                propsJSON = obj.propsJSON,
                propsFilePath = obj.propsFilePath,
                commonPropsJsonList = obj.commonPropsJsonList,
                isI18nExists = false,
                isCommonKey = false,
                localizedText = '',
                locale = util.getLocaleFromFilePath(dustFilePath, localesRootPath),
                commonPropsJson = {},
                ret = '';
            
            commonPropsJsonList.forEach(function(obj){
                if(obj[locale]){
                  commonPropsJson = obj[locale];
                }
            });  
            /*
            ** Though we can use the RegExp object's exec or String.prototype.match method, 
            ** however the String.prototype.replace method is much easier and flexible to generate the resouce bundle file
            ** no matter this file format is a JAVA property or JSON file
            */
            ret = content.replace(i18nRegExp, function(match, key, value, offset, origStr){

                if(!isI18nExists){
                    isI18nExists = true;
                }
                
                // Fetch the localized message associated with this key, firstly search in the associated dust template
                // if not found, then search it in the common properties files, if still not found then abort the grunt task.
                localizedText = propsJSON[key];
                
                if(util.isEmpty(localizedText)){

                    localizedText = commonPropsJson[key];
                    
                    if(util.isEmpty(localizedText)){
                        grunt.fail.fatal('[[ missing key: ' + (key).bold + ' ]] in file - ' + (dustFilePath).bold);
                    }
                    else{
                        grunt.verbose.writeln('[precompile] ==== this key [[' + (key).blue + ']] has been found in locale [[ ' + (locale).yellow + ' ]]');
                    }
                }
                else{
                    grunt.verbose.writeln('[precompile] ==== this key [[' + (key).blue + ']] has been found in locale [[ ' + (locale).yellow + ' ]]');
                }
                
                return localizedText;
            });

            if(isI18nExists){
                grunt.log.writeln('[precompile] ==== this file has i18n tag: ', dustFilePath);
                grunt.file.write(dustFilePath, ret);
            }
        });


    });

};