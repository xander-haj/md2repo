# md2repo
a website that will tuen your md file, or md based text into real code files      
this site will:   
      
- parse an uploaded md file or the contents from a chat that are in Markdown, you can manually copy text if that is easier than navigating the files tab, so should work with any AI
then if there are any code files in the text it will generate the actual files for you

- left over text or instructions that are not code files will be written to readme.md

# suggestions on how to use:
when prompting the AI, tell it when writing code to:
```
always write the file name and directory above the codeblock as a header, and inside the file as a comment. Never include brevity, truncated lines, or placeholder logic in your output
```

which is what the site looks for, but should still work if the header isn't present, as long as it detects:    
`path/filename`
```
AI written code here
```
