var _ = require('underscore'),
    moment = require('moment');

(function () {

  'use strict';

  var inboxServices = angular.module('inboxServices');

  inboxServices.factory('GenerateSearchQuery', ['Settings',
    function(Settings) {

      var formatDate = function(date) {
        return date.zone(0).format('YYYY-MM-DD');
      };

      var formatReportedDate = function($scope) {
        if ($scope.filterModel.date.to || $scope.filterModel.date.from) {
          // increment end date so it's inclusive
          var to = moment($scope.filterModel.date.to).add(1, 'days');
          var from = moment($scope.filterModel.date.from || 0);
          return 'reported_date<date>:[' + 
              formatDate(from) + ' TO ' + formatDate(to) + 
              ']';
        }
      };

      var formatType = function($scope) {
        if ($scope.filterModel.type === 'reports') {
          return 'type:report';
        }
        return 'type:message*';
      };

      var formatForm = function($scope) {
        var selectedForms = $scope.filterModel.forms.length;
        if (selectedForms > 0 && selectedForms < $scope.forms.length) {
          var formCodes = [];
          $scope.filterModel.forms.forEach(function(form) {
            formCodes.push(form.code);
          });
          return 'form:(' + formCodes.join(' OR ') + ')';
        }
      };

      var formatErrors = function($scope) {
        if ($scope.filterModel.valid === true) {
          return 'errors<int>:0';
        }
        if ($scope.filterModel.valid === false) {
          return 'NOT errors<int>:0';
        }
      };

      var formatVerified = function($scope) {
        if ($scope.filterModel.verified === true) {
          return 'verified:true';
        }
        if ($scope.filterModel.verified === false) {
          return 'verified:false';
        }
      };

      var formatClinics = function($scope) {
        var selectedFacilities = $scope.filterModel.facilities.length;
        if (selectedFacilities > 0 && selectedFacilities < $scope.facilities.length) {
          return 'clinic:(' + $scope.filterModel.facilities.join(' OR ') + ')';
        }
      };
      
      var formatDistrict = function($scope, showUnallocated) {
        if ($scope.permissions.districtAdmin) {
          var value = $scope.permissions.district;
          if (showUnallocated) {
            value += ' OR none';
          }
          return 'district:(' + value + ')';
        }
      };

      var formatIds = function(options) {
        if (options.changes && options.changes.length) {
          var updatedIds = _.map(options.changes, function(result) {
            return '"' + result.id + '"';
          });
          return 'uuid:(' + updatedIds.join(' OR ') + ')';
        }
      };

      var formatFreetext = function($scope) {
        var result = $scope.filterQuery;
        if (result && result.indexOf(':') === -1) {
          result += '*';
        }
        return result;
      };

      return function($scope, options, callback) {

        Settings(function(err, res) {

          if (err) {
            return callback(err);
          }

          var filters = [];

          filters.push(formatFreetext($scope));
          filters.push(formatReportedDate($scope));
          filters.push(formatType($scope));
          filters.push(formatClinics($scope));
          filters.push(formatForm($scope));
          filters.push(formatErrors($scope));
          filters.push(formatVerified($scope));
          filters.push(formatDistrict($scope, res.district_admins_access_unallocated_messages));
          filters.push(formatIds(options));

          callback(null, _.compact(filters).join(' AND '));

        });
        
      };
    }
  ]);
}());