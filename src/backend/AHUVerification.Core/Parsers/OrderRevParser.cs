using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml.Linq;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Parsers
{
    public class OrderRevParser
    {
        public OrderRevisionData Parse(string xmlContent)
        {
            if (string.IsNullOrWhiteSpace(xmlContent))
                return new OrderRevisionData();

            var doc = XDocument.Parse(xmlContent);
            var root = doc.Root;
            if (root == null)
                return new OrderRevisionData();

            string GetElementValue(string localName, string defaultValue = "")
            {
                var el = root.Elements().FirstOrDefault(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase));
                return el?.Value?.Trim() ?? defaultValue;
            }

            int GetElementInt(string localName, int defaultValue = 1)
            {
                var str = GetElementValue(localName);
                return int.TryParse(str, out var v) ? v : defaultValue;
            }

            var orderRev = new OrderRevisionData
            {
                ProductType = GetElementValue("productType"),
                JobName = GetElementValue("jobName"),
                OrderNumber = GetElementValue("orderNumber"),
                LineNumber = GetElementInt("lineNumber", 1),
                ProjectName = GetElementValue("projectName"),
                ProjectId = GetElementValue("projectID"),
                BaseSQOrderNumber = GetElementValue("baseSQOrderNumber")
            };

            // Parse tagList
            var tagListEl = root.Elements().FirstOrDefault(e => e.Name.LocalName.Equals("tagList", StringComparison.OrdinalIgnoreCase));
            if (tagListEl != null)
            {
                foreach (var tagEl in tagListEl.Elements().Where(e => e.Name.LocalName.Equals("tag", StringComparison.OrdinalIgnoreCase)))
                {
                    var tagVal = tagEl.Value?.Trim();
                    if (!string.IsNullOrEmpty(tagVal))
                    {
                        orderRev.TagList.Add(tagVal);
                    }
                }
            }

            return orderRev;
        }
    }
}
