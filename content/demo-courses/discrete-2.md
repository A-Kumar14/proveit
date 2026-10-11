---
title: Discrete 2
topic: Mathematics
level: Intermediate
summary: Sets, counting and probability, the toolkit behind algorithms and data. Built on the course's set theory and counting chapters.
---

# Discrete 2

The second discrete structures course. It starts from sets and the ways to combine them, uses that to count outcomes carefully, and then turns counting into probability.

## Sets

### Set notation and cardinality
A set is a well-defined collection of distinct elements. It can be written by listing elements, by a word description, or in set-builder notation such as the set of all x such that x is an even counting number less than 10. The cardinal number n(A) is how many distinct elements A has, so repeated listings count once and the empty set has cardinality 0.

### Subsets and the power set
A is a subset of B when every element of A is also in B. A proper subset is a subset that is not equal to the whole set. A set with n elements has 2 to the power n subsets, because each element is either in or out of a subset, and 2 to the n minus 1 proper subsets.

### Set operations and De Morgan's laws
Union collects elements in either set, intersection keeps elements in both, difference keeps elements of A that are not in B, and the complement is everything in the universal set outside A. De Morgan's laws say the complement of a union is the intersection of the complements, and the complement of an intersection is the union of the complements.

### Inclusion-exclusion
The cardinal number formula says n of A union B equals n of A plus n of B minus n of A intersect B. Subtracting the overlap stops elements in both sets from being counted twice. With three sets, add the singles, subtract the pairwise overlaps and add back the triple overlap.

## Counting

### Product and sum rules
If a task is a sequence of independent steps, the number of ways is the product of the ways for each step. If it is a choice between disjoint options, the number of ways is the sum. Most counting problems are a careful mix of the two.

### Permutations
A permutation is an ordered arrangement. The number of ways to arrange r items chosen from n distinct items is n factorial divided by n minus r factorial. Order matters, so ABC and CAB are different arrangements.

### Combinations
A combination is an unordered selection. The number of ways to choose r items from n is n factorial divided by r factorial times n minus r factorial, often read n choose r. It equals the permutation count divided by r factorial, because each selection can be ordered r factorial ways.

### Pigeonhole principle
If more than n items are placed into n boxes, at least one box holds two or more items. The general form says some box holds at least the ceiling of items divided by boxes. It proves that something must exist without finding it.

## Probability

### Sample spaces and events
A sample space lists every possible outcome of an experiment, and an event is a subset of it. When outcomes are equally likely, the probability of an event is the number of outcomes in it divided by the number of outcomes in the sample space, so counting from the earlier unit does the work.

### Conditional probability and Bayes
The probability of A given B is the probability of A and B divided by the probability of B. Bayes' rule turns it around: the probability of A given B equals the probability of B given A times the probability of A, divided by the probability of B. It is how evidence updates a prior belief.

### Expected value
A random variable assigns a number to each outcome. Its expected value is the sum of each value times its probability, the long-run average over many trials. Expectation is linear, so the expected value of a sum is the sum of the expected values even when the variables are not independent.
