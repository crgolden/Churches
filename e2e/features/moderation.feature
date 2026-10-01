Feature: Reviewing corrections
  Moderators review the corrections members suggest, and approve or reject each one.

  Scenario: Only moderators see the queue
    Given a church with full details is listed in the directory
    And I am a signed-in member
    When I open the moderation queue
    Then I am taken to the home page

  Scenario: A moderator sees a waiting correction
    Given a correction to a church's street is waiting for review
    And I am a moderator
    When I open the moderation queue
    Then I see that correction, linked to its church

  Scenario: Approving a correction applies it
    Given a correction to a church's street is waiting for review
    And I am a moderator
    And I have opened the moderation queue
    When I approve that correction
    Then the moderation queue is empty
    And that church shows the corrected street

  Scenario: Rejecting a correction removes it from the queue
    Given a correction to a church's street is waiting for review
    And I am a moderator
    And I have opened the moderation queue
    When I reject that correction
    Then the moderation queue is empty

  Scenario: An empty queue says so
    Given a church with full details is listed in the directory
    And I am a moderator
    When I open the moderation queue
    Then the moderation queue is empty
