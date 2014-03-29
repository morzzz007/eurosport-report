/*global angular, console, _, moment, $ */


var eurosportApp = angular.module('eurosportApp',[]);

eurosportApp.controller('reportController', ['$scope', function($scope) {

    'use strict';

    String.prototype.reverse=function(){return this.split("").reverse().join("");};

    var reader = new FileReader();

    var eus1EventColor = '#428bca';
    var eus2EventColor = '#d9534f';
    var eus2NEEventColor = '#5bc0de';
    var eus1Name = 'INTER';
    var eus2Name = 'EUROSPORT 2';
    var eus2NEName = 'EUROSPORT 2 NORTH-EAST';

    $scope.supported = angular.isDefined(window.FileReader);
    $scope.selectedFile;
    $scope.textResult;
    $scope.jsonData;
    $scope.calendarEvents = [];
    $scope.parseComplete = false;
    $scope.logData = [];
    $scope.printView = false;

    $scope.progressStyle = {
        width : $scope.progressPercentage +'%'
    };

    $scope.togglePrintView = function () {
        $scope.printView = !$scope.printView;
    }

    $scope.displayDate = function (date) {
       return moment(date).format("YYYY/MM/DD HH:mm");
    };

    function csvToJSON (csvText) {
        $scope.logData = [];

        var resultObject = [];

        var lines = csvText.split(/[\r\n]+/g);      // tolerate both Windows and Unix linebreaks

        var max = lines.length;

        if( max <= 1 ) {
            logMessage("A fájl valószínűleg hibás, mert túl kevés sorból áll.", 2);
            return;
        }

        var current = 0;
        var fatalError = false;
        lines.forEach(function(line) {
            if (fatalError) return;
            current++;
            var lineDatas = line.split("\t");
            if (lineDatas.length > 10){
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
                
                computeCancelled(tempProgramme);
                computeRealTime(tempProgramme);
                computeBaseDate(tempProgramme);
                computeCalendarDates(tempProgramme);


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
            } else {
                if (line !== "") {
                    logMessage("A fájl nem tartalmaz elég adatot.", 2);
                    fatalError = true;
                }
            }
            setPercentage(current, max);
        });

        $scope.parseComplete = true;
        makeFullCalendarEvents(resultObject);
        $scope.$broadcast('initCalendar');
        return resultObject;
    }

    $scope.returnEventColor = function (programme) {
        if (programme.channel == eus1Name) {
            return eus1EventColor;
        }
        if (programme.channel == eus2Name) {
            return eus2EventColor;
        }
        if (programme.channel == eus2NEName) {
            return eus2NEEventColor;
        }
    };

    $scope.returnResourceId = function (programme) {
        if (programme.channel == eus1Name) {
            return 1;
        }
        if (programme.channel == eus2Name) {
            return 2;
        }
        if (programme.channel == eus2NEName) {
            return 3;
        }
    };

    function makeFullCalendarEvents(array) {
        var fullCalendarEvents = [];
        array.forEach(function (programme) {
            if(!programme.cancelled)
                fullCalendarEvents.push( {
                    title  : programme.id,
                    start  : moment(programme.calendarStartDate).format("YYYY-MM-DD HH:mm"),
                    end    : moment(programme.calendarEndDate).format("YYYY-MM-DD HH:mm"),
                    allDay : false,
                    color  : $scope.returnEventColor(programme),
                    resourceId: $scope.returnResourceId(programme)
                });
        });

        $scope.calendarEvents = fullCalendarEvents;
    }

    function computeCalendarDates (programmeObject) {
        var startTimeDatas = programmeObject.computedStartTime.split(":");
        var m = moment(programmeObject.date);

        if(startTimeDatas[0] >= 0 && startTimeDatas[0] < 3) {
            logMessage("A " + programmeObject.id + " számú műsor másnap kezdődik (?)", 2);
            m.add('days', 1);
        } else if(startTimeDatas[0] >= 24) {
            logMessage("A " + programmeObject.id + " számú műsor másnap kezdődik.", 1);
            startTimeDatas[0] = startTimeDatas[0] - 24; // start date will be the next date
            m.add('days', 1);
        }

        m.set('hour', startTimeDatas[0]);
        m.set('minute', startTimeDatas[1]);

        programmeObject.calendarStartDate = m.toDate();

        var endTimeDatas = programmeObject.computedEndTime.split(":");
        m = moment(programmeObject.date);

        if(endTimeDatas[0] >= 0 && endTimeDatas[0] < 3) {
            logMessage("A " + programmeObject.id + " számú műsor másnap végződik (?)", 2);
            m.add('days', 1);
        } else if (endTimeDatas[0] >= 24) {
            logMessage("A " + programmeObject.id + " számú műsor másnap végződik.", 1);
            endTimeDatas[0] = endTimeDatas[0] - 24; // end date will be the next date
            m.add('days', 1);
        }



        m.set('hour', endTimeDatas[0]);
        m.set('minute', endTimeDatas[1]);

        programmeObject.calendarEndDate = m.toDate();
    }

    function setPercentage (current, max) {
        $scope.progressStyle.width = (current/max * 100) + '%';
    }

    function computeBaseDate (programmeObject) {
        // a date looks like this: Sun 16/03/2014
        var extractedDate = programmeObject.date.reverse().substring(0,10).reverse();
        var day = extractedDate.substring(0,2);
        var month = extractedDate.substring(3,5);
        var year = extractedDate.substring(6,10);

        programmeObject.date = new Date(year, month - 1, day);

    }

    function computeRealTime (programmeObject) {
        // start time
        programmeObject.computedStartTime = programmeObject.realStartTime.length > 1 ? programmeObject.realStartTime : programmeObject.originalStartTime;

        // end time
        programmeObject.computedEndTime = programmeObject.realEndTime.length > 1 ? programmeObject.realEndTime : programmeObject.originalEndTime;
    }

    function computeCancelled (programmeObject) {
        programmeObject.cancelled = programmeObject.id.length < 1 ? true : false;
        programmeObject.cancelled = _.isNumber(programmeObject.id) ? false : true;
        if (programmeObject.cancelled)
            logMessage("A " + programmeObject.programme + " elmaradt.", 1);
    }

    function logMessage (message, level) {
        $scope.logData.push({ message : message, level : level});
    }

    $scope.fileSelected = function (file) {

        if(file.length == 1)
        {

            // check extension
            if(file[0].name.indexOf(".txt") > 0){
                reader.readAsText(file[0]);

                reader.onload = function() {
                    $scope.calendarEvents = [];
                    $scope.parseComplete = false;
                    $scope.logData = [];
                    $scope.textResult = reader.result;
                    $scope.jsonData = csvToJSON(reader.result);
                    $scope.$digest();
                };
            } else {
                $scope.logData = [];
                logMessage("Nem megfelelő formátum.", 2);
                $scope.calendarEvents = [];
                $scope.parseComplete = false;
                $scope.jsonData = [];
                $scope.$digest();
            }

        }

    };
}]);

eurosportApp.directive('fullCalendar', function(){

    'use strict';

    return {
        scope: {
            events : "="
        },
        restrict: 'EA',
        link: function($scope, iElm) {

            $('#calendar-prev-button').click(function() {
                $('#calendar').fullCalendar('prev');
                updateDate();
            });
            $('#calendar-next-button').click(function() {
                $('#calendar').fullCalendar('next');
                updateDate();
            });

            function updateDate () {
                $('#calendar-date').text(moment($('#calendar').fullCalendar('getDate')).format("YYYY/MM/DD"));
            }

            $scope.$watch('events', function (newVal) {
                if(newVal.length !== 0){
                    $(iElm).fullCalendar({
                        allDaySlot : false,
                        header: false,
                        theme: true,
                        defaultView : "resourceDay",
                        events: $scope.events,
                        slotEventOverlap : false,resources: [
                            { name: 'Eurosport Inter', id: 1 },
                            { name: 'Eurosport 2', id: 2 },
                            { name: 'Eurosport 2 NE', id: 3 },
                        ],
                        timeFormat: 'HH:mm',
                        axisFormat: 'HH:mm',
                        buttonText: {
                            prev: 'előző nap',
                            next: 'következő nap',
                            today: 'mai nap',
                        }
                    });

                    $(iElm).fullCalendar('gotoDate', newVal[0].start);
                    updateDate();
                }
            });


        }
    };
});

eurosportApp.directive('uploadButton', function(){

    'use strict';

    return {
        restrict: 'A',
        link: function($scope, $element) {
            var fileElem = document.getElementById("fileElem");

            $element.bind('click', function (e) {
                if (fileElem) {
                    fileElem.click();
                }
                e.preventDefault();
            });

        }
    };
});