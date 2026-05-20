import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plus, Trash2, Code, FileText, FileCode } from "lucide-react";

interface MarcField {
  id: string;
  tag: string;
  ind1: string;
  ind2: string;
  content: string;
}

const defaultMarcRecord: MarcField[] = [
  { id: '1', tag: '001', ind1: '', ind2: '', content: '123456789' },
  { id: '2', tag: '003', ind1: '', ind2: '', content: 'DLC' },
  { id: '3', tag: '005', ind1: '', ind2: '', content: '20230101120000.0' },
  { id: '4', tag: '008', ind1: '', ind2: '', content: '230101s2023    nyu           000 1 eng  ' },
  { id: '5', tag: '020', ind1: ' ', ind2: ' ', content: '$a 9780132350884 $q (paperback)' },
  { id: '6', tag: '100', ind1: '1', ind2: ' ', content: '$a Martin, Robert C. $e author.' },
  { id: '7', tag: '245', ind1: '1', ind2: '0', content: '$a Clean code : $b a handbook of agile software craftsmanship / $c Robert C. Martin.' },
  { id: '8', tag: '260', ind1: ' ', ind2: ' ', content: '$a Upper Saddle River, NJ : $b Prentice Hall, $c 2008.' },
  { id: '9', tag: '300', ind1: ' ', ind2: ' ', content: '$a xxix, 431 pages : $b illustrations ; $c 24 cm' },
  { id: '10', tag: '650', ind1: ' ', ind2: '0', content: '$a Software engineering.' },
];

interface MarcEditorBook {
  isbn?: string | null;
  title?: string;
  author?: string;
  publisher?: string | null;
  publishedYear?: number | null;
  category?: string | null;
}

function bookToMarcFields(book: MarcEditorBook): MarcField[] {
  const year = book.publishedYear ? String(book.publishedYear) : '';
  const yy = year.slice(2, 4);
  const fields: MarcField[] = [
    { id: '1', tag: '001', ind1: '', ind2: '', content: (book.isbn || '').replace(/[^0-9X]/gi, '') || 'UNKNOWN' },
    { id: '2', tag: '003', ind1: '', ind2: '', content: 'LIB' },
    { id: '3', tag: '005', ind1: '', ind2: '', content: new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 16) + '.0' },
    { id: '4', tag: '008', ind1: '', ind2: '', content: `${yy}0101s${year}           000 0 eng  ` },
  ];
  if (book.isbn) {
    fields.push({ id: '5', tag: '020', ind1: ' ', ind2: ' ', content: `$a ${book.isbn}` });
  }
  if (book.author) {
    fields.push({ id: '6', tag: '100', ind1: '1', ind2: ' ', content: `$a ${book.author}.` });
  }
  if (book.title) {
    const titleContent = book.author
      ? `$a ${book.title} / $c ${book.author}.`
      : `$a ${book.title}.`;
    fields.push({ id: '7', tag: '245', ind1: '1', ind2: '0', content: titleContent });
  }
  if (book.publisher && year) {
    fields.push({ id: '8', tag: '260', ind1: ' ', ind2: ' ', content: `$b ${book.publisher}, $c ${year}.` });
  }
  if (book.category) {
    fields.push({ id: '9', tag: '650', ind1: ' ', ind2: '0', content: `$a ${book.category}.` });
  }
  return fields;
}

export function MarcEditor({ book }: { book?: MarcEditorBook | null }) {
  const [fields, setFields] = useState<MarcField[]>(book ? bookToMarcFields(book) : defaultMarcRecord);

  useEffect(() => {
    if (book) {
      setFields(bookToMarcFields(book));
    }
  }, [book?.isbn, book?.title]);

  const addField = () => {
    const newField: MarcField = {
      id: Math.random().toString(36).substr(2, 9),
      tag: '',
      ind1: '',
      ind2: '',
      content: ''
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, key: keyof MarcField, value: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  // Simple function to generate MARCXML from current fields
  const generateMarcXml = () => {
    const controlFields = fields.filter(f => parseInt(f.tag) < 10);
    const dataFields = fields.filter(f => parseInt(f.tag) >= 10);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<record xmlns="http://www.loc.gov/MARC21/slim">\n`;
    xml += `  <leader>01234nam a2200345 i 4500</leader>\n`;
    
    controlFields.forEach(field => {
      xml += `  <controlfield tag="${field.tag}">${field.content}</controlfield>\n`;
    });

    dataFields.forEach(field => {
      xml += `  <datafield tag="${field.tag}" ind1="${field.ind1 || ' '}" ind2="${field.ind2 || ' '}">\n`;
      
      // Quick hack to parse subfields (assuming $a format)
      const parts = field.content.split('$').filter(p => p.length > 0);
      parts.forEach(part => {
        const code = part.charAt(0);
        const data = part.substring(1).trim();
        xml += `    <subfield code="${code}">${data}</subfield>\n`;
      });
      
      xml += `  </datafield>\n`;
    });

    xml += `</record>`;
    return xml;
  };

  return (
    <Card className="w-full border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>MARC21 Editor{book?.title ? ` — ${book.title}` : ''}</CardTitle>
            <CardDescription>
              {book
                ? `Bibliographic record for "${book.title}"${book.author ? ` by ${book.author}` : ''}`
                : 'Edit bibliographic records in raw MARC format.'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Code className="h-4 w-4" />
              Validate
            </Button>
            <Button size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              Save Record
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <Tabs defaultValue="editor" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="editor" className="gap-2">
              <FileText className="h-4 w-4" />
              Field Editor
            </TabsTrigger>
            <TabsTrigger value="raw" className="gap-2">
              <Code className="h-4 w-4" />
              Raw MARC
            </TabsTrigger>
            <TabsTrigger value="xml" className="gap-2">
              <FileCode className="h-4 w-4" />
              MARCXML
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="editor" className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Tag</TableHead>
                    <TableHead className="w-[60px]">Ind1</TableHead>
                    <TableHead className="w-[60px]">Ind2</TableHead>
                    <TableHead>Content (Subfields)</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell className="p-2">
                        <Input 
                          value={field.tag} 
                          onChange={(e) => updateField(field.id, 'tag', e.target.value)}
                          className="h-8 font-mono" 
                          maxLength={3}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          value={field.ind1} 
                          onChange={(e) => updateField(field.id, 'ind1', e.target.value)}
                          className="h-8 font-mono text-center" 
                          maxLength={1}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          value={field.ind2} 
                          onChange={(e) => updateField(field.id, 'ind2', e.target.value)}
                          className="h-8 font-mono text-center" 
                          maxLength={1}
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          value={field.content} 
                          onChange={(e) => updateField(field.id, 'content', e.target.value)}
                          className="h-8 font-mono text-blue-700" 
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => removeField(field.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" onClick={addField} className="w-full gap-2 border-dashed">
              <Plus className="h-4 w-4" />
              Add Field
            </Button>
          </TabsContent>
          
          <TabsContent value="raw">
            <div className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap border">
              LDR  01234nam a2200345 i 4500<br/>
              {fields.map(f => `${f.tag} ${f.ind1 || ' '}${f.ind2 || ' '} ${f.content}`).join('\n')}
            </div>
          </TabsContent>

          <TabsContent value="xml">
            <div className="relative">
              <div className="p-4 bg-muted rounded-md font-mono text-xs whitespace-pre-wrap border overflow-x-auto text-blue-800 dark:text-blue-300">
                {generateMarcXml()}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
