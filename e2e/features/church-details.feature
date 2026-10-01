Feature: A church's page
  Each church has a page with what the directory knows about it, and moderators keep its details current.

  Scenario: Seeing everything a church has published
    Given a church with full details is listed in the directory
    And I am a visitor
    When I open that church's page
    Then I see all of that church's details
    And I see that church and its campuses on a map

  Scenario: A church with only basic details shows nothing empty
    Given a church with only basic details is listed in the directory
    And I am a visitor
    When I open that church's page
    Then I see no empty details

  Scenario: Opening a church that does not exist
    Given I am a visitor
    When I open a church page that does not exist
    Then I am told the church was not found

  Scenario: An inactive church cannot be opened
    Given an inactive church is in the directory
    And I am a visitor
    When I open that church's page
    Then I am told the church was not found

  Scenario: A church the directory is unsure about still opens
    Given a church the directory has low confidence in is listed
    And I am a visitor
    When I open that church's page
    Then I see that church's page

  Scenario: Visitors are not offered to suggest a correction
    Given a church with full details is listed in the directory
    And I am a visitor
    When I open that church's page
    Then I am not offered to suggest a correction

  Scenario: Members are offered to suggest a correction
    Given a church with full details is listed in the directory
    And I am a signed-in member
    When I open that church's page
    Then I am offered to suggest a correction

  Scenario: A moderator adds a service time
    Given a church with only basic details is listed in the directory
    And I am a moderator
    And I have opened that church's page
    When I add a service time
    Then I see the new service time

  Scenario: A moderator removes a service time
    Given a church with full details is listed in the directory
    And I am a moderator
    And I have opened that church's page
    When I remove that church's first service time
    Then that service time is gone

  Scenario: A moderator adds a ministry
    Given a church with only basic details is listed in the directory
    And I am a moderator
    And I have opened that church's page
    When I add a ministry
    Then I see the new ministry
