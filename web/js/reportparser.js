/*global angular, console, _ */

var eurosportApp = angular.module('eurosportApp',[]);

eurosportApp.controller('reportController', ['$scope', function($scope) {

    'use strict';

    var reader = new FileReader();

    $scope.selectedFile;
    $scope.textResult;
    $scope.jsonData;

    $scope.parseComplete = false;
    $scope.logData = [];

    $scope.progressStyle = {
        width : $scope.progressPercentage +'%'
    };

    function csvToJSON (csvText) {
        var resultObject = [];

        var lines = csvText.split(/[\r\n]+/g);      // tolerate both Windows and Unix linebreaks

        var max = lines.length;
        var current = 0;

        lines.forEach(function(line) {
            current++;
            var lineDatas = line.split(";");
            if (lineDatas.length > 1){
                var tempProgramme = {
                    commentatorName : lineDatas[0],
                    date : lineDatas[1],
                    originalStartTime : lineDatas[2].trim().substring(0,5),
                    originalEndTime : lineDatas[3].trim().substring(0,5),
                    programme : lineDatas[4],
                    type : lineDatas[5],
                    channel : lineDatas[6],
                    id : lineDatas[7],
                    commentatorIds : lineDatas[8],
                    realStartTime : lineDatas[9],
                    realEndTime : lineDatas[10]
                };
                
                computeRealTime(tempProgramme);
                computeCancelled(tempProgramme);

                // look for identical object before pushing
                var possibleIdentical = _.find(resultObject, function(prog){
                    return prog.id == tempProgramme.id &&
                           prog.computedStartTime == tempProgramme.computedStartTime &&
                           prog.computedEndTime == tempProgramme.computedEndTime;
                });

                if (!possibleIdentical) {
                    resultObject.push(tempProgramme);
                } else {
                    logMessage("A " + tempProgramme.id + " számú műsor kétszer szerepelt azonos időpontban.", 1);
                }
            }
            setPercentage(current, max);
        });

        $scope.parseComplete = true;
        return resultObject;
    }

    function setPercentage (current, max) {
        $scope.progressStyle.width = (current/max * 100) + '%';
    }

    function computeRealTime (programmeObject) {
        // start time
        programmeObject.computedStartTime = programmeObject.realStartTime.length > 1 ? programmeObject.realStartTime : programmeObject.originalStartTime;

        // end time
        programmeObject.computedEndTime = programmeObject.realEndTime.length > 1 ? programmeObject.realEndTime : programmeObject.originalEndTime;
    }

    function computeCancelled (programmeObject) {
        programmeObject.cancelled = programmeObject.id.length < 1 ? true : false;
        if (programmeObject.cancelled)
            logMessage("A " + programmeObject.programme + " elmaradt.", 1);
    }

    function logMessage (message, level) {
        $scope.logData.push({ message : message, level : level});
    }

    $scope.fileSelected = function (file) {

        reader.readAsText(file[0]);

        reader.onload = function() {
            $scope.textResult = reader.result;
            $scope.jsonData = csvToJSON(reader.result);
            $scope.$digest();
        };

    };
}]);