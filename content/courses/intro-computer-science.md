---
title: Intro to Computer Science
topic: Computing
level: Beginner
summary: Programming fundamentals, core data structures, how fast code runs, and how a computer executes it.
---

# Intro to Computer Science

A first course in how programs are written and how they run. It covers the building blocks of code, the data structures that hold information, how to reason about speed, and what happens inside the machine.

## Building blocks of code

### Variables and types
A variable is a name attached to a value. Every value has a type, such as an integer, a floating-point number, a string or a boolean, and the type decides what operations make sense. Adding two integers gives a number, while adding two strings joins them. Many bugs come from mixing types without noticing.

### Control flow
Control flow decides which instructions run and how often. A conditional such as if and else chooses between paths based on a boolean test. A loop such as for or while repeats a block while a condition holds. Together they let a program react to data and process any amount of it with a fixed amount of code.

### Functions
A function is a named, reusable block of code that takes inputs, called parameters, and can return an output. Functions break big problems into small pieces that can be tested alone. A function should do one clear job, and its variables are local, so they do not collide with names elsewhere in the program.

## Data structures

### Arrays and lists
An array stores items in order in a contiguous block of memory, so reading the item at any index is fast. Inserting or deleting in the middle is slower because later items must shift. Most languages offer a resizable list built on arrays that grows when it fills up.

### Hash maps
A hash map stores key and value pairs. A hash function turns a key into a position, so looking up a key takes about the same time no matter how many entries exist. Two keys can land in the same spot, which is called a collision, and a good implementation handles that. Use a map when you need to find things by name instead of position.

### Big-O notation
Big-O describes how the work of an algorithm grows as the input size n grows, ignoring constant factors. Looking up a hash map entry is roughly constant time, scanning a list is linear, and comparing every pair of items is quadratic. The difference matters most at large n, where a quadratic algorithm can become unusably slow.

## How computers run code

### Binary and memory
Computers store everything as bits, which are zeros and ones. Eight bits make a byte. Numbers, text and images are all encoded as patterns of bits, and text is mapped to numbers by an encoding such as Unicode. Memory is a long row of numbered bytes, and a variable is a name for a location in that row.

### Compilers and interpreters
A compiler translates a whole program into machine code before it runs, which usually gives fast programs. An interpreter reads and runs the program step by step, which makes it easier to test quickly. Many languages mix both, compiling to an intermediate form that a virtual machine then runs.
