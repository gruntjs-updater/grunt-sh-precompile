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
    propsRegExp = /\.properties$/,
    multiLineRegExp = /\\\r?\n\s*/g,
    missingKeyRegExp = /(\{\{.*\}\})/,
    path = require('path'),
    sep = path.sep,
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
                commonPropsFolder: 'common',
                commonPropsFile: 'app.properties',
                missingKeyMsgPattern: '[[missing key: {{missing.key.msg}}]]',
                commonPropsKeyPatternRegExp: '^common\\.'
            }),
            templatesFolder = options.templatesFolder,
            scriptsFolder = options.scriptsFolder,
            localesFolder = options.localesFolder,
            commonPropsFolder = options.commonPropsFolder,
            commonPropsFile = options.commonPropsFile,
            localesRootPath = options.localesRootPath,
            missingKeyMsgPattern = options.missingKeyMsgPattern,
            commonPropsKeyPatternRegExp = new RegExp(options.commonPropsKeyPatternRegExp),
            commonPropsJsonList = [], // contains the locale - commonPropsJson, e.g. [{'DE-de': {'key':'value'}}]
            localesList = [], // locales list will be an array containing normalized Country-lang code list, e.g. ['DE-de', 'US-en', 'GB-en'];
            localizedTemplatesList = [];

        // To get all of the available locales list and commonPropsJsonList
        console.log('============localesRootPath=======', localesRootPath);
        file.readdirSync(localesRootPath).forEach(function(country, idx) {
            var countryPath = path.join(localesRootPath, country),
                locale = '',
                commonPropsFilePath = '',
                commonPropsJson = {};

            file.readdirSync(countryPath).forEach(function(lang, idx) {
                locale = util.getNormalizedLocale(country, lang);
                if (localesList.indexOf(locale) == -1) {
                    localesList.push(locale);
                    commonPropsFilePath = path.join(localesRootPath, country, lang, commonPropsFolder, commonPropsFile);
                    commonPropsJson[locale] = grunt.file.exists(commonPropsFilePath) ? util.convertPropsToJson(grunt.file.read(commonPropsFilePath)) : {};
                    commonPropsJsonList.push(commonPropsJson);
                }
            });

        });


        console.log('===========localesList is==========', localesList);
        console.log('===========commonPropsJsonList is==========', commonPropsJsonList);

        // Copy all the source dust template files to each targeted locale folder.
        this.filesSrc.forEach(function(srcpath, idx) {
            var destpath = '',
                localeFolder = 'US/en',
                templatespath = srcpath.split(sep).slice(1).join(sep);

            console.log('=====src template path=====', srcpath);

            localesList.forEach(function(locale, idx) {
                localeFolder = locale.split('-').join(sep);
                destpath = path.join(localesRootPath, localeFolder, templatespath);

                localizedTemplatesList.push(destpath);

                grunt.file.copy(srcpath, destpath, {
                    noProcess: false
                });

            });

        });

        /*
        ** Handle the {@i18n} tag in each dust template file in each locale, replace it with associated localized properties file
        ** Or show the missing key error message if the key is missing
        */
        // console.log('=========localizedTemplatesList', localizedTemplatesList);
        localizedTemplatesList.map(function(filepath){
            var dustFilePath = filepath,
                dustFileContent = grunt.file.read(dustFilePath),
                propsFile = dustFilePath.replace(dustRegExp, '.properties'),
                isPropsExists = grunt.file.exists(propsFile),
                propsJSON = isPropsExists ? util.convertPropsToJson(grunt.file.read(propsFile)) : {};

            return {
                dustFilePath: dustFilePath,
                dustFileContent: dustFileContent,
                propsJSON: propsJSON,
                commonPropsJsonList: commonPropsJsonList
            };

        }).forEach(function(obj, idx){
            var content = obj.dustFileContent,
                dustFilePath = obj.dustFilePath,
                propsJSON = obj.propsJSON,
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
                /*console.log('==============================');
                console.log('match: ', match);
                console.log('key: ', key);
                console.log('value: ', value);*/

                isCommonKey = commonPropsKeyPatternRegExp.test(key);
                
                if(isCommonKey){
                    localizedText = commonPropsJson[key];
                }
                else{
                  localizedText = propsJSON[key];
                }

                if(!localizedText){
                  localizedText = missingKeyMsgPattern.replace(missingKeyRegExp, key);
                }
                
                return localizedText;
            });

            if(isI18nExists){
                console.log('==== processed file is =====', dustFilePath);
                grunt.file.write(dustFilePath, ret);
            }
        });


    });

};