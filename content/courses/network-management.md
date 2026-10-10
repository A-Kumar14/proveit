---
title: Network Management
topic: IT
level: Intermediate
summary: How networks are structured, how core services work, and how to monitor, troubleshoot and secure them.
---

# Network Management

A course for people who run or support networks. It covers the models that describe how data moves, the services every network depends on, and the habits that keep networks healthy.

## Foundations

### OSI and TCP/IP models
The OSI model splits networking into seven layers: physical, data link, network, transport, session, presentation and application. The TCP/IP model groups these into four. Layers give a shared vocabulary for problems, so a cable fault is a layer 1 issue, a routing fault is layer 3, and a failing web request may be layer 7.

### IP addressing and subnetting
An IPv4 address has 32 bits written as four numbers. A subnet mask, or a prefix such as /24, says how many leading bits identify the network and how many identify the host. A /24 network leaves 8 host bits, which is 256 addresses, of which 254 are usable because the first and last are reserved. Subnetting divides a larger network into smaller ones.

## Core services

### DNS
The Domain Name System translates names into IP addresses. A resolver asks a chain of servers, starting with the root, then the top-level domain, then the domain's own name server. Answers are cached for a time set by the record's TTL. Many outages that look like "the network is down" are really DNS failures.

### DHCP
DHCP gives devices an address and settings automatically when they join. The exchange is discover, offer, request and acknowledge. A server hands out addresses from a pool for a lease time, along with the default gateway and DNS servers. A static reservation always gives one device the same address.

### NAT and firewalls
Network address translation lets many devices with private addresses share one public address by rewriting addresses and ports on the way out. A firewall allows or blocks traffic using rules. A stateful firewall tracks connections, so replies to allowed outgoing traffic are let back in without opening the network to everything.

## Operations

### Monitoring
Monitoring means measuring device and link health before users complain. SNMP lets a management system poll devices for counters such as interface traffic, errors and CPU use. Set a baseline of normal behaviour, then alert on deviations, because a number only means something when compared with what is usual.

### Troubleshooting method
A good method beats guessing. Define the problem, gather information, form a theory, test it, make a plan and fix, verify the fix, and document it. Working layer by layer from the bottom or the top narrows the cause quickly. Change one thing at a time so you know what fixed it.

### Network security basics
Security starts with least privilege, giving each user and device only the access it needs. Segmenting a network with VLANs and firewall rules limits how far an intruder can move. A VPN encrypts traffic across an untrusted network such as the internet. Patching devices and turning off unused services remove common ways in.
